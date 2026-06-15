import { Injectable, Logger } from '@nestjs/common';

import { Readable } from 'stream';

import { OrgChartData } from 'twenty-shared';

import { CandidateAvatarStorageService } from 'src/engine/core-modules/candidate-avatar/services/candidate-avatar-storage.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';

const ORG_CHART_S3_FOLDER = 'org-charts';

/**
 * Optional sub-folder appended under `org-charts/<companyId>/` so that
 * variants for the same company (full-company, leadership, theorg-enriched,
 * …) don't overwrite each other.
 *
 * When omitted the S3 path keeps its legacy shape (`org-charts/<companyId>/`)
 * — this is what the full-company LinkedIn/Apollo builders have always used
 * and what the credit-transaction bookkeeping still keys off, so leaving the
 * default unchanged preserves backward compatibility.
 */
export type OrgChartS3Variant = string | undefined;

@Injectable()
export class OrgChartS3Service {
  private readonly logger = new Logger(OrgChartS3Service.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly candidateAvatarStorageService: CandidateAvatarStorageService,
  ) {}

  private normalizeSegment(segment: string, fallback = 'unknown'): string {
    return (
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || fallback
    );
  }

  private normalizeCompanyId(companyId: string): string {
    return this.normalizeSegment(companyId);
  }

  private normalizeVariant(variant: OrgChartS3Variant): string | undefined {
    if (typeof variant !== 'string') {
      return undefined;
    }
    const trimmed = variant.trim();
    if (!trimmed) {
      return undefined;
    }
    return this.normalizeSegment(trimmed, 'variant');
  }

  private buildFolderPath(
    companyId: string,
    variant: OrgChartS3Variant,
  ): string {
    const normalizedId = this.normalizeCompanyId(companyId);
    const normalizedVariant = this.normalizeVariant(variant);

    return normalizedVariant
      ? `${ORG_CHART_S3_FOLDER}/${normalizedId}/${normalizedVariant}`
      : `${ORG_CHART_S3_FOLDER}/${normalizedId}`;
  }

  /**
   * Same raw key passed to saveOrgChart / saveCandidates before folder normalization.
   * Keeps S3 paths aligned with callers that persist after a full-company LinkedIn search.
   */
  persistedCompanyFolderKey(
    companyId: string | undefined,
    resolvedCompanyName: string,
  ): string {
    return (
      (typeof companyId === 'string' && companyId.trim()) ||
      resolvedCompanyName.replace(/\s+/g, '-').toLowerCase()
    );
  }

  /**
   * Folder path under the file-storage root (matches metadata.orgChartS3RelativePath on debits).
   *
   * When {@link variant} is provided, a sub-folder is appended so different
   * chart kinds for the same company live in distinct locations.
   */
  buildRelativeFolderPathFromPersistedKey(
    persistedKey: string,
    variant?: OrgChartS3Variant,
  ): string {
    return this.buildFolderPath(persistedKey, variant);
  }

  async saveOrgChart(
    companyId: string,
    orgChart: OrgChartData,
    variant?: OrgChartS3Variant,
  ): Promise<void> {
    const folder = this.buildFolderPath(companyId, variant);
    const hydrated = await this.candidateAvatarStorageService.ingestOrgChartData(
      orgChart as Record<string, unknown>,
    );

    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(hydrated)),
        name: 'orgchart.json',
        folder,
        mimeType: 'application/json',
      });
      this.logger.log(`Saved org chart to S3: ${folder}/orgchart.json`);
    } catch (error) {
      this.logger.error(
        `Failed to save org chart to S3 for companyId=${companyId} variant=${variant ?? 'default'}`,
        error,
      );
    }
  }

  async saveCandidates(
    companyId: string,
    candidates: unknown[],
    variant?: OrgChartS3Variant,
  ): Promise<void> {
    const folder = this.buildFolderPath(companyId, variant);
    const rows = candidates.filter(
      (row): row is Record<string, unknown> =>
        !!row && typeof row === 'object' && !Array.isArray(row),
    );
    const hydrated = await this.candidateAvatarStorageService.ingestBatch(rows);

    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(hydrated)),
        name: 'candidates.json',
        folder,
        mimeType: 'application/json',
      });
      this.logger.log(
        `Saved ${candidates.length} candidates to S3: ${folder}/candidates.json`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save candidates to S3 for companyId=${companyId} variant=${variant ?? 'default'}`,
        error,
      );
    }
  }

  /**
   * Tries each lookup entry in order (alias-aware plans from {@link buildOrgChartS3LookupPlan}).
   */
  async tryGetOrgChartFromLookupEntries(
    entries: Array<{ companyId: string; s3Variant?: OrgChartS3Variant }>,
  ): Promise<OrgChartData | null> {
    for (const entry of entries) {
      const orgChart = await this.getOrgChart(entry.companyId, entry.s3Variant);
      if (orgChart) {
        return orgChart;
      }
    }
    return null;
  }

  async getOrgChart(
    companyId: string,
    variant?: OrgChartS3Variant,
  ): Promise<OrgChartData | null> {
    const folder = this.buildFolderPath(companyId, variant);

    try {
      const stream = await this.fileStorageService.read({
        folderPath: folder,
        filename: 'orgchart.json',
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as OrgChartData;

      this.logger.log(
        `Loaded org chart from S3 for companyId=${companyId} variant=${variant ?? 'default'} (folder=${folder})`,
      );

      return parsed;
    } catch (error) {
      this.logger.log(
        `No org chart found in S3 for companyId=${companyId} variant=${variant ?? 'default'}: ${(error as Error).message}`,
      );

      return null;
    }
  }

  async getCandidates(
    companyId: string,
    variant?: OrgChartS3Variant,
  ): Promise<unknown[] | null> {
    const folder = this.buildFolderPath(companyId, variant);

    try {
      const stream = await this.fileStorageService.read({
        folderPath: folder,
        filename: 'candidates.json',
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as unknown[];

      this.logger.log(
        `Loaded ${parsed.length} candidates from S3 for companyId=${companyId} variant=${variant ?? 'default'}`,
      );

      return parsed;
    } catch (error) {
      this.logger.log(
        `No candidates found in S3 for companyId=${companyId} variant=${variant ?? 'default'}: ${(error as Error).message}`,
      );

      return null;
    }
  }

  /**
   * Removes orgchart.json / candidates.json (and folder prefix objects) for a persisted company key.
   * Same key as {@link saveOrgChart} / {@link persistedCompanyFolderKey}.
   *
   * When {@link variant} is provided, only that sub-folder is deleted. When
   * omitted, only the legacy default folder is removed (variant sub-folders
   * are left untouched on purpose).
   */
  async deletePersistedCompanyFolder(
    persistedKey: string,
    variant?: OrgChartS3Variant,
  ): Promise<void> {
    const folderPath = this.buildRelativeFolderPathFromPersistedKey(
      persistedKey,
      variant,
    );
    try {
      await this.fileStorageService.delete({ folderPath });
      this.logger.log(`Deleted org chart S3 folder: ${folderPath}`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete org chart S3 folder ${folderPath}`,
        error as Error,
      );
    }
  }

  async saveSuperImposeManifest(
    companyId: string,
    manifest: Record<string, unknown>,
    variant?: OrgChartS3Variant,
  ): Promise<void> {
    const folder = this.buildFolderPath(companyId, variant);

    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(manifest)),
        name: 'super-impose-manifest.json',
        folder,
        mimeType: 'application/json',
      });
      this.logger.log(
        `Saved super-impose manifest to S3: ${folder}/super-impose-manifest.json`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save super-impose manifest for companyId=${companyId}`,
        error as Error,
      );
    }
  }

  async getSuperImposeManifest(
    companyId: string,
    variant?: OrgChartS3Variant,
  ): Promise<Record<string, unknown> | null> {
    const folder = this.buildFolderPath(companyId, variant);

    try {
      const stream = await this.fileStorageService.read({
        folderPath: folder,
        filename: 'super-impose-manifest.json',
      });
      const content = await this.streamToString(stream);
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
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
