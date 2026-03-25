import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import { OrgChartData } from 'twenty-shared';

const ORG_CHART_S3_FOLDER = 'org-charts';

@Injectable()
export class OrgChartS3Service {
  private readonly logger = new Logger(OrgChartS3Service.name);

  constructor(private readonly fileStorageService: FileStorageService) {}

  private normalizeCompanyId(companyId: string): string {
    return (
      companyId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'unknown'
    );
  }

  async saveOrgChart(companyId: string, orgChart: OrgChartData): Promise<void> {
    const normalizedId = this.normalizeCompanyId(companyId);
    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(orgChart)),
        name: 'orgchart.json',
        folder: `${ORG_CHART_S3_FOLDER}/${normalizedId}`,
        mimeType: 'application/json',
      });
      this.logger.log(
        `Saved org chart to S3: ${ORG_CHART_S3_FOLDER}/${normalizedId}/orgchart.json`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save org chart to S3 for companyId=${companyId}`,
        error,
      );
    }
  }

  async saveCandidates(
    companyId: string,
    candidates: unknown[],
  ): Promise<void> {
    const normalizedId = this.normalizeCompanyId(companyId);
    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(candidates)),
        name: 'candidates.json',
        folder: `${ORG_CHART_S3_FOLDER}/${normalizedId}`,
        mimeType: 'application/json',
      });
      this.logger.log(
        `Saved ${candidates.length} candidates to S3: ${ORG_CHART_S3_FOLDER}/${normalizedId}/candidates.json`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save candidates to S3 for companyId=${companyId}`,
        error,
      );
    }
  }

  async getOrgChart(companyId: string): Promise<OrgChartData | null> {
    const normalizedId = this.normalizeCompanyId(companyId);
    try {
      const stream = await this.fileStorageService.read({
        folderPath: `${ORG_CHART_S3_FOLDER}/${normalizedId}`,
        filename: 'orgchart.json',
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as OrgChartData;
      this.logger.log(
        `Loaded org chart from S3 for companyId=${companyId} (normalizedId=${normalizedId})`,
      );
      return parsed;
    } catch (error) {
      this.logger.log(
        `No org chart found in S3 for companyId=${companyId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getCandidates(companyId: string): Promise<unknown[] | null> {
    const normalizedId = this.normalizeCompanyId(companyId);
    try {
      const stream = await this.fileStorageService.read({
        folderPath: `${ORG_CHART_S3_FOLDER}/${normalizedId}`,
        filename: 'candidates.json',
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as unknown[];
      this.logger.log(
        `Loaded ${parsed.length} candidates from S3 for companyId=${companyId}`,
      );
      return parsed;
    } catch (error) {
      this.logger.log(
        `No candidates found in S3 for companyId=${companyId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }
}
