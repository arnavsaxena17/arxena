import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import type { UnipileLinkedinProduct } from 'src/engine/core-modules/linkedin-search/utils/unipile-linkedin-product.util';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

import {
  COMPANY_DATA_SOURCE_CATEGORIES,
  type CompanyDataSourceAlias,
} from './constants/company-data-source-aliases';
import type { CompanySearchDto } from './dto/company-search.dto';
import type {
  CompanyDataSourcesStatusResponse,
  CompanySearchHit,
  CompanySearchResponse,
} from './company-api.types';
import { CompanySearchDataSourceResolver } from './services/company-search-data-source.resolver';
import { CompanySearchHitTransformer } from './services/company-search-hit.transformer';

@Injectable()
export class CompanyApiService {
  private readonly logger = new Logger(CompanyApiService.name);

  constructor(
    private readonly companiesEsService: CompaniesEsService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly companySearchDataSourceResolver: CompanySearchDataSourceResolver,
    private readonly companySearchHitTransformer: CompanySearchHitTransformer,
  ) {}

  getDataSourcesStatus(): CompanyDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const configuredByAlias: Record<CompanyDataSourceAlias, boolean> = {
      auto: unipileConfigured || this.harvestLinkedinService.isConfigured(),
      index: this.companiesEsService.isEnabled(),
      harvest: this.harvestLinkedinService.isConfigured(),
      unipile: unipileConfigured,
      pool: unipileConfigured,
      recruiter: unipileConfigured,
    };

    return {
      status: 'ok',
      sources: COMPANY_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  async searchCompanies(
    body: CompanySearchDto,
    apiToken?: string,
  ): Promise<CompanySearchResponse> {
    const resolved = await this.companySearchDataSourceResolver.resolve({
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });
    const limit = Math.max(1, Math.min(100, body.limit ?? 20));
    const keywords =
      body.keywords?.trim() ||
      body.companyName?.trim() ||
      body.query?.trim() ||
      '';

    if (resolved.dataSource === 'index') {
      const result = await this.companiesEsService.searchCompanies({
        query: body.query,
        companyName: body.companyName,
        website: body.website,
        industry: body.industry,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'index',
        total: result.total,
        items: result.items.map((item) =>
          this.companySearchHitTransformer.fromIndexItem(item),
        ),
      };
    }

    if (resolved.dataSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const result = await this.harvestLinkedinService.searchCompanies({
        search: keywords || body.website,
        location: body.location,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: result.items.map((item) =>
          this.companySearchHitTransformer.fromHarvestItem(item),
        ),
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this company search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const items = await this.searchUnipileCompanies({
      keywords: keywords || body.website || body.industry || '',
      location: body.location,
      industry: body.industry,
      accountId: resolved.accountId,
      product: resolved.unipileProduct ?? 'sales_navigator',
      limit,
    });

    return {
      status: 'ok',
      dataSource: resolved.dataSource,
      unipileProduct: resolved.unipileProduct,
      total: items.length,
      items,
    };
  }

  private async searchUnipileCompanies(input: {
    keywords: string;
    location?: string;
    industry?: string;
    accountId: string;
    product: UnipileLinkedinProduct;
    limit: number;
  }): Promise<CompanySearchHit[]> {
    const location = input.location?.trim()
      ? [input.location.trim()]
      : undefined;
    const industry = input.industry?.trim()
      ? [input.industry.trim()]
      : undefined;

    if (input.product === 'recruiter') {
      const response = await this.linkedInSearchService.searchCompaniesRecruiter(
        { keywords: input.keywords || undefined, location, industry },
        input.accountId,
        { limit: input.limit },
      );

      return this.companySearchHitTransformer.fromUnipileItems(
        response.items as Array<{ type?: string } & Record<string, unknown>>,
      );
    }

    if (input.product === 'classic') {
      const response = await this.linkedInSearchService.searchCompanies(
        { keywords: input.keywords || undefined, location, industry },
        input.accountId,
        { limit: input.limit },
      );

      return this.companySearchHitTransformer.fromUnipileItems(
        response.items as Array<{ type?: string } & Record<string, unknown>>,
      );
    }

    try {
      const response =
        await this.linkedInSearchService.searchCompaniesSalesNavigator(
          { keywords: input.keywords || undefined },
          input.accountId,
          { limit: input.limit },
        );

      return this.companySearchHitTransformer.fromUnipileItems(
        response.items as Array<{ type?: string } & Record<string, unknown>>,
      );
    } catch (error) {
      this.logger.warn(
        `Sales Nav company search failed, falling back to classic: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      const response = await this.linkedInSearchService.searchCompanies(
        { keywords: input.keywords || undefined, location, industry },
        input.accountId,
        { limit: input.limit },
      );

      return this.companySearchHitTransformer.fromUnipileItems(
        response.items as Array<{ type?: string } & Record<string, unknown>>,
      );
    }
  }
}
