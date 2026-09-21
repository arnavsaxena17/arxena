import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { GetObjectCommand, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { isNonEmptyString } from '@sniptt/guards';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const DEFAULT_PUBLIC_ORGCHARTS_BUCKET = 'arxena-orgcharts-940813655147';

export type OrgChartCatalogDocument = Record<string, unknown>;

@Injectable()
export class OrgChartCatalogS3Service implements OnModuleInit {
  private readonly logger = new Logger(OrgChartCatalogS3Service.name);
  private client: S3 | null = null;
  private bucketName = DEFAULT_PUBLIC_ORGCHARTS_BUCKET;

  constructor(private readonly environmentService: EnvironmentService) {}

  onModuleInit(): void {
    const bucketFromEnv = this.environmentService.get(
      'ORGCHARTS_PUBLIC_S3_BUCKET',
    );
    this.bucketName = isNonEmptyString(bucketFromEnv)
      ? bucketFromEnv
      : DEFAULT_PUBLIC_ORGCHARTS_BUCKET;

    const region =
      this.environmentService.get('STORAGE_S3_REGION') ?? 'us-east-1';
    const accessKeyId = this.environmentService.get('STORAGE_S3_ACCESS_KEY_ID');
    const secretAccessKey = this.environmentService.get(
      'STORAGE_S3_SECRET_ACCESS_KEY',
    );
    const endpoint = this.environmentService.get('STORAGE_S3_ENDPOINT');

    try {
      this.client = new S3({
        region,
        ...(isNonEmptyString(endpoint) ? { endpoint } : {}),
        credentials:
          isNonEmptyString(accessKeyId) && isNonEmptyString(secretAccessKey)
            ? {
                accessKeyId,
                secretAccessKey,
              }
            : fromNodeProviderChain(),
      });
      this.logger.log(
        `Org chart public catalog S3 client configured for bucket "${this.bucketName}"`,
      );
    } catch (error) {
      this.client = null;
      this.logger.warn(
        `Org chart public catalog S3 client unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null && isNonEmptyString(this.bucketName);
  }

  buildCatalogKey(input: {
    companyId: string;
    type?: string;
    country?: string;
  }): string {
    const companyId = input.companyId.trim();
    const docType = input.type?.trim() || 'fullcompany';
    const countryRaw = input.country?.trim() || 'global';
    const country = countryRaw.toLowerCase().replace(/ /g, '-');

    return `data/${companyId}_${docType}_${country}.json`;
  }

  async getCatalogDocument(input: {
    companyId: string;
    type?: string;
    country?: string;
  }): Promise<OrgChartCatalogDocument | null> {
    if (!this.client || !isNonEmptyString(input.companyId)) {
      return null;
    }

    const key = this.buildCatalogKey(input);

    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      const body = await response.Body?.transformToString();
      if (!isNonEmptyString(body)) {
        return null;
      }
      const parsed = JSON.parse(body) as OrgChartCatalogDocument;
      this.logger.debug(
        `Org chart catalog S3 hit companyId=${input.companyId} key=${key}`,
      );
      return parsed;
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'name' in error
          ? (error as { name?: string }).name
          : undefined;
      if (
        statusCode === 'NoSuchKey' ||
        statusCode === 'NotFound' ||
        (error &&
          typeof error === 'object' &&
          '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode === 404)
      ) {
        return null;
      }
      this.logger.debug(
        `Org chart catalog S3 get failed key=${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async putCatalogDocument(input: {
    companyId: string;
    type?: string;
    country?: string;
    document: OrgChartCatalogDocument;
  }): Promise<void> {
    if (!this.client || !isNonEmptyString(input.companyId)) {
      return;
    }

    const key = this.buildCatalogKey(input);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: JSON.stringify(input.document),
          ContentType: 'application/json',
        }),
      );
      this.logger.debug(
        `Org chart catalog S3 write-through companyId=${input.companyId} key=${key}`,
      );
    } catch (error) {
      this.logger.warn(
        `Org chart catalog S3 put failed key=${key}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
