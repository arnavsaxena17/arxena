import { createHash } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import sharp from 'sharp';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import {
    FileStorageException,
    FileStorageExceptionCode,
} from 'src/engine/core-modules/file-storage/interfaces/file-storage-exception';
import { normalizeOrgChartLinkedinUrlKey } from 'src/engine/core-modules/org-chart/utils/merge-orgchart-profile-source-slugs.util';
import {
    extractLinkedinProfileUrlFromOrgChartCandidateRow,
    extractProfilePictureUrlFromOrgChartCandidateRow,
} from 'src/engine/core-modules/org-chart/utils/orgchart-candidate-linkedin-url.util';
import { UserProfile } from 'twenty-shared';

import {
    AVATAR_FILENAME,
    AVATAR_IMAGE_FIELD_NAMES,
    AVATAR_META_FOLDER,
    AVATAR_PUBLIC_PATH_PREFIX,
    AVATAR_S3_FOLDER,
} from '../candidate-avatar.constants';
import { CandidateAvatarFetchService } from './candidate-avatar-fetch.service';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_CONCURRENCY = 8;
const AVATAR_EDGE_PX = 256;

export type AvatarIngestInput = {
  imageUrl: string;
  linkedinUrl?: string;
};

@Injectable()
export class CandidateAvatarStorageService {
  private readonly logger = new Logger(CandidateAvatarStorageService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly candidateAvatarFetchService: CandidateAvatarFetchService,
  ) {}

  isIngestEnabled(): boolean {
    const flag = process.env.CANDIDATE_AVATAR_INGEST_ENABLED?.trim().toLowerCase();
    return flag !== 'false' && flag !== '0';
  }

  getMaxBytes(): number {
    const parsed = Number(process.env.CANDIDATE_AVATAR_MAX_BYTES);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BYTES;
  }

  getFetchTimeoutMs(): number {
    const parsed = Number(process.env.CANDIDATE_AVATAR_FETCH_TIMEOUT_MS);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_FETCH_TIMEOUT_MS;
  }

  resolveStableKey(input: AvatarIngestInput): string | null {
    const linkedin = input.linkedinUrl?.trim();
    if (linkedin) {
      return createHash('sha256')
        .update(normalizeOrgChartLinkedinUrlKey(linkedin))
        .digest('hex');
    }

    const imageUrl = input.imageUrl?.trim();
    if (!imageUrl || this.isPersistedAvatarUrl(imageUrl)) {
      return null;
    }

    try {
      const normalized = new URL(imageUrl).href;
      return createHash('sha256').update(normalized).digest('hex');
    } catch {
      return createHash('sha256').update(imageUrl).digest('hex');
    }
  }

  getPublicAvatarPath(stableKey: string): string {
    return `${AVATAR_PUBLIC_PATH_PREFIX}${stableKey}`;
  }

  isPersistedAvatarUrl(url: string): boolean {
    const trimmed = url.trim();
    if (!trimmed) {
      return false;
    }

    if (trimmed.startsWith(AVATAR_PUBLIC_PATH_PREFIX)) {
      return true;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.pathname.startsWith(AVATAR_PUBLIC_PATH_PREFIX);
    } catch {
      return false;
    }
  }

  private s3FolderForKey(stableKey: string): string {
    return `${AVATAR_S3_FOLDER}/${stableKey}`;
  }

  async avatarExists(stableKey: string): Promise<boolean> {
    try {
      await this.fileStorageService.read({
        folderPath: this.s3FolderForKey(stableKey),
        filename: AVATAR_FILENAME,
      });
      return true;
    } catch (error) {
      if (
        error instanceof FileStorageException &&
        error.code === FileStorageExceptionCode.FILE_NOT_FOUND
      ) {
        return false;
      }
      return false;
    }
  }

  async readAvatarStream(stableKey: string) {
    return this.fileStorageService.read({
      folderPath: this.s3FolderForKey(stableKey),
      filename: AVATAR_FILENAME,
    });
  }

  async readAvatarBuffer(stableKey: string): Promise<Buffer | null> {
    try {
      const stream = await this.readAvatarStream(stableKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  private async writeMeta(
    stableKey: string,
    meta: { sourceUrl: string; linkedinUrl?: string; ingestedAt: string },
  ): Promise<void> {
    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(meta)),
        name: 'meta.json',
        folder: `${AVATAR_META_FOLDER}/${stableKey}`,
        mimeType: 'application/json',
      });
    } catch (error) {
      this.logger.warn(`Failed to write avatar meta for key=${stableKey}`, error);
    }
  }

  async readMeta(
    stableKey: string,
  ): Promise<{ sourceUrl: string; linkedinUrl?: string; ingestedAt: string } | null> {
    try {
      const stream = await this.fileStorageService.read({
        folderPath: `${AVATAR_META_FOLDER}/${stableKey}`,
        filename: 'meta.json',
      });
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
        sourceUrl: string;
        linkedinUrl?: string;
        ingestedAt: string;
      };
    } catch {
      return null;
    }
  }

  private async processToWebp(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()
      .resize(AVATAR_EDGE_PX, AVATAR_EDGE_PX, {
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  }

  async ingestFromUrl(input: AvatarIngestInput): Promise<string> {
    const imageUrl = input.imageUrl?.trim() ?? '';
    if (!imageUrl) {
      return imageUrl;
    }

    if (!this.isIngestEnabled() || this.isPersistedAvatarUrl(imageUrl)) {
      return imageUrl;
    }

    const stableKey = this.resolveStableKey({
      imageUrl,
      linkedinUrl: input.linkedinUrl,
    });
    if (!stableKey) {
      return imageUrl;
    }

    const publicPath = this.getPublicAvatarPath(stableKey);
    if (await this.avatarExists(stableKey)) {
      return publicPath;
    }

    if (!this.candidateAvatarFetchService.isAllowedUrl(imageUrl)) {
      return imageUrl;
    }

    const { ok, buffer } = await this.candidateAvatarFetchService.fetchImageBuffer(
      imageUrl,
      this.getFetchTimeoutMs(),
    );

    if (!ok || buffer.byteLength === 0) {
      return imageUrl;
    }

    if (buffer.byteLength > this.getMaxBytes()) {
      this.logger.warn(
        `Avatar ingest skipped oversized image (${buffer.byteLength} bytes) key=${stableKey}`,
      );
      return imageUrl;
    }

    try {
      const webp = await this.processToWebp(buffer);
      await this.fileStorageService.write({
        file: webp,
        name: AVATAR_FILENAME,
        folder: this.s3FolderForKey(stableKey),
        mimeType: 'image/webp',
      });
      await this.writeMeta(stableKey, {
        sourceUrl: imageUrl,
        linkedinUrl: input.linkedinUrl?.trim() || undefined,
        ingestedAt: new Date().toISOString(),
      });
      this.logger.log(`Avatar ingested key=${stableKey}`);
      return publicPath;
    } catch (error) {
      this.logger.warn(`Avatar ingest failed key=${stableKey}`, error);
      return imageUrl;
    }
  }

  async ingestRecordImageFields(
    record: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const linkedinUrl =
      extractLinkedinProfileUrlFromOrgChartCandidateRow(record) || undefined;
    const rewritten: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (key === 'orgchart' && typeof value === 'string') {
        try {
          const parsed = JSON.parse(value) as unknown;
          const hydrated = await this.rewriteValue(parsed);
          rewritten[key] = JSON.stringify(hydrated);
        } catch {
          rewritten[key] = value;
        }
        continue;
      }

      if (AVATAR_IMAGE_FIELD_NAMES.has(key) && typeof value === 'string') {
        rewritten[key] = await this.ingestFromUrl({
          imageUrl: value,
          linkedinUrl,
        });
        continue;
      }

      if (
        AVATAR_IMAGE_FIELD_NAMES.has(key) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        const link = value as Record<string, unknown>;
        const url = link.primaryLinkUrl;
        if (typeof url === 'string' && url.trim()) {
          rewritten[key] = {
            ...link,
            primaryLinkUrl: await this.ingestFromUrl({
              imageUrl: url,
              linkedinUrl,
            }),
          };
        } else {
          rewritten[key] = value;
        }
        continue;
      }

      if (Array.isArray(value)) {
        rewritten[key] = await Promise.all(
          value.map((entry) => this.rewriteValue(entry)),
        );
        continue;
      }

      if (value && typeof value === 'object') {
        rewritten[key] = await this.ingestRecordImageFields(
          value as Record<string, unknown>,
        );
        continue;
      }

      rewritten[key] = value;
    }

    return rewritten;
  }

  private async rewriteValue(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((entry) => this.rewriteValue(entry)));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return this.ingestRecordImageFields(value as Record<string, unknown>);
  }

  async ingestBatch<T extends Record<string, unknown>>(
    records: T[],
    options?: { concurrency?: number },
  ): Promise<T[]> {
    if (!this.isIngestEnabled() || records.length === 0) {
      return records;
    }

    const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
    const result: T[] = [...records];
    let index = 0;

    const worker = async () => {
      while (index < records.length) {
        const currentIndex = index;
        index += 1;
        const row = records[currentIndex];
        const imageUrl = extractProfilePictureUrlFromOrgChartCandidateRow(row);
        if (!imageUrl) {
          continue;
        }
        const linkedinUrl =
          extractLinkedinProfileUrlFromOrgChartCandidateRow(row) || undefined;
        const persisted = await this.ingestFromUrl({ imageUrl, linkedinUrl });
        if (persisted !== imageUrl) {
          result[currentIndex] = {
            ...row,
            profile_picture_url: persisted,
            profilePictureUrl: persisted,
            displayPicture: persisted,
            image: persisted,
          } as T;
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, records.length) }, worker),
    );

    return result;
  }

  async ingestOrgChartData<T extends Record<string, unknown>>(
    orgChart: T,
  ): Promise<T> {
    if (!this.isIngestEnabled()) {
      return orgChart;
    }
    return (await this.rewriteValue(orgChart)) as T;
  }

  async ingestUserProfileImages(profile: UserProfile): Promise<UserProfile> {
    if (!this.isIngestEnabled()) {
      return profile;
    }

    const linkedinUrl =
      (typeof profile.linkedinUrl === 'string' && profile.linkedinUrl.trim()) ||
      (typeof profile.profileUrl === 'string' &&
        profile.profileUrl.includes('linkedin.com') &&
        profile.profileUrl.trim()) ||
      undefined;

    let displayPictureUrl = '';
    const dp = profile.displayPicture;
    if (typeof dp === 'string') {
      displayPictureUrl = dp;
    } else if (dp && typeof dp === 'object' && 'primaryLinkUrl' in dp) {
      displayPictureUrl =
        typeof dp.primaryLinkUrl === 'string' ? dp.primaryLinkUrl : '';
    }

    if (!displayPictureUrl) {
      displayPictureUrl =
        (typeof profile.profilePictureUrl === 'string' &&
          profile.profilePictureUrl) ||
        '';
    }

    if (!displayPictureUrl) {
      return profile;
    }

    const persisted = await this.ingestFromUrl({
      imageUrl: displayPictureUrl,
      linkedinUrl,
    });

    if (persisted === displayPictureUrl) {
      return profile;
    }

    return {
      ...profile,
      displayPicture: {
        primaryLinkLabel: 'Display Picture',
        primaryLinkUrl: persisted,
      },
      profilePictureUrl: persisted,
    };
  }

  async hydratePersistPayload(input: {
    items?: unknown[];
    orgChart?: Record<string, unknown>;
  }): Promise<{ items?: unknown[]; orgChart?: Record<string, unknown> }> {
    if (!this.isIngestEnabled()) {
      return input;
    }

    const items = Array.isArray(input.items)
      ? await this.ingestBatch(
          input.items.filter(
            (row): row is Record<string, unknown> =>
              !!row && typeof row === 'object' && !Array.isArray(row),
          ),
        )
      : input.items;

    const orgChart = input.orgChart
      ? await this.ingestOrgChartData(input.orgChart)
      : input.orgChart;

    return { items, orgChart };
  }
}
