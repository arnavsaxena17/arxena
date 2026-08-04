import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { BuiltWithService } from 'src/engine/core-modules/builtwith/services/builtwith.service';

import {
  companyTechnologyFetchRecordSchema,
  companyTechnologyStorageSchema,
  type CompanyTechnologyResult,
  type CompanyTechnologyStorage,
} from '../schemas/company-technology.schema';
import { OrgChartS3Service } from './orgchart-s3.service';

@Injectable()
export class OrgChartCompanyTechnologyService {
  private readonly logger = new Logger(OrgChartCompanyTechnologyService.name);

  constructor(
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly builtWithService: BuiltWithService,
  ) {}

  async getStoredCompanyTechnology(
    companyId: string,
  ): Promise<CompanyTechnologyStorage | null> {
    const raw = await this.orgChartS3Service.getCompanyTechnology(companyId);

    if (!raw) {
      return null;
    }

    return companyTechnologyStorageSchema.parse(raw);
  }

  getLatestTechnologyResult(
    storage: CompanyTechnologyStorage | null | undefined,
  ): CompanyTechnologyResult | null {
    if (!storage?.fetches?.length) {
      return null;
    }

    const orderedFetches = [...storage.fetches].sort((left, right) =>
      right.fetchedAt.localeCompare(left.fetchedAt),
    );

    return orderedFetches[0]?.result ?? null;
  }

  async fetchAndStoreCompanyTechnology(input: {
    companyId: string;
    companyName: string;
    domain: string;
  }): Promise<CompanyTechnologyStorage> {
    const companyId = input.companyId.trim();
    const companyName = input.companyName.trim() || companyId;
    const domain = input.domain.trim().toLowerCase();

    if (!domain) {
      throw new HttpException(
        'Domain is required to fetch technology details',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Fetching BuiltWith technology for companyId=${companyId} domain=${domain}`,
    );

    const builtWithResult = await this.builtWithService.fetchDomain(domain, {
      includeDetailed: true,
      includeProfile: false,
    });
    const fetchedAt = new Date().toISOString();
    const fetchRecord = companyTechnologyFetchRecordSchema.parse({
      fetchedAt,
      result: {
        ...builtWithResult,
        fetchedAt,
      },
    });

    const existing = await this.getStoredCompanyTechnology(companyId);
    const nextStorage = companyTechnologyStorageSchema.parse({
      companyId,
      companyName,
      domain,
      updatedAt: fetchedAt,
      fetches: [...(existing?.fetches ?? []), fetchRecord],
    });

    await this.orgChartS3Service.saveCompanyTechnology(companyId, nextStorage);
    this.logger.log(
      `Saved company technology to S3 for companyId=${companyId} fetchCount=${nextStorage.fetches.length} techCount=${builtWithResult.detailedTechnologies.length}`,
    );

    return nextStorage;
  }
}
