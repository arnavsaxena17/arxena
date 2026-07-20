import { Injectable, Logger } from '@nestjs/common';

import { Readable } from 'stream';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';

const LINKEDIN_PROFILES_S3_FOLDER = 'linkedin-profiles';

export type LinkedinProfileS3Envelope<T> = {
  fetchedAt: string;
  profile: T;
};

/** Durable S3 cache for LinkedIn user/company profile JSON keyed by public identifier (90-day freshness). */
@Injectable()
export class LinkedinProfileS3Service {
  private readonly logger = new Logger(LinkedinProfileS3Service.name);

  static readonly DEFAULT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

  constructor(private readonly fileStorageService: FileStorageService) {}

  private normalizeSegment(segment: string, fallback = 'unknown'): string {
    return (
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || fallback
    );
  }

  private buildUserFolder(publicIdentifier: string): string {
    return `${LINKEDIN_PROFILES_S3_FOLDER}/users/${this.normalizeSegment(publicIdentifier)}`;
  }

  private buildCompanyFolder(publicIdentifier: string): string {
    return `${LINKEDIN_PROFILES_S3_FOLDER}/companies/${this.normalizeSegment(publicIdentifier)}`;
  }

  private isFresh(
    fetchedAt: string | undefined,
    maxAgeMs: number,
  ): boolean {
    if (!fetchedAt?.trim()) {
      return false;
    }
    const fetchedAtMs = Date.parse(fetchedAt);
    if (Number.isNaN(fetchedAtMs)) {
      return false;
    }
    return Date.now() - fetchedAtMs <= maxAgeMs;
  }

  async getLinkedinUserProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    maxAgeMs = LinkedinProfileS3Service.DEFAULT_MAX_AGE_MS,
  ): Promise<T | null> {
    const envelope = await this.readEnvelope<T>(
      this.buildUserFolder(publicIdentifier),
      `user publicIdentifier=${publicIdentifier}`,
    );
    if (!envelope || !this.isFresh(envelope.fetchedAt, maxAgeMs)) {
      return null;
    }
    return envelope.profile;
  }

  async saveLinkedinUserProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    profile: T,
  ): Promise<void> {
    await this.writeEnvelope(
      this.buildUserFolder(publicIdentifier),
      profile,
      `user publicIdentifier=${publicIdentifier}`,
    );
  }

  async getLinkedinCompanyProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    maxAgeMs = LinkedinProfileS3Service.DEFAULT_MAX_AGE_MS,
  ): Promise<T | null> {
    const envelope = await this.readEnvelope<T>(
      this.buildCompanyFolder(publicIdentifier),
      `company publicIdentifier=${publicIdentifier}`,
    );
    if (!envelope || !this.isFresh(envelope.fetchedAt, maxAgeMs)) {
      return null;
    }
    return envelope.profile;
  }

  async saveLinkedinCompanyProfile<T extends Record<string, unknown>>(
    publicIdentifier: string,
    profile: T,
  ): Promise<void> {
    await this.writeEnvelope(
      this.buildCompanyFolder(publicIdentifier),
      profile,
      `company publicIdentifier=${publicIdentifier}`,
    );
  }

  private async readEnvelope<T>(
    folder: string,
    logContext: string,
  ): Promise<LinkedinProfileS3Envelope<T> | null> {
    try {
      const stream = await this.fileStorageService.read({
        folderPath: folder,
        filename: 'profile.json',
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as LinkedinProfileS3Envelope<T>;
      if (!parsed?.profile || typeof parsed.profile !== 'object') {
        return null;
      }
      this.logger.log(
        `LinkedIn profile S3 cache HIT (${logContext}, folder=${folder})`,
      );
      return parsed;
    } catch (error) {
      this.logger.log(
        `LinkedIn profile S3 cache MISS (${logContext}, folder=${folder}): ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async writeEnvelope<T>(
    folder: string,
    profile: T,
    logContext: string,
  ): Promise<void> {
    const envelope: LinkedinProfileS3Envelope<T> = {
      fetchedAt: new Date().toISOString(),
      profile,
    };

    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(envelope)),
        name: 'profile.json',
        folder,
        mimeType: 'application/json',
      });
      this.logger.log(
        `Saved LinkedIn profile to S3 (${logContext}, folder=${folder}/profile.json)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save LinkedIn profile to S3 (${logContext}, folder=${folder})`,
        error,
      );
    }
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];

      stream.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as string);

        chunks.push(new Uint8Array(buf));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }
}
