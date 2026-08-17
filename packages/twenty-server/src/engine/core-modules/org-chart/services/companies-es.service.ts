import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { buildCompanyWebsiteLookupVariants } from 'src/engine/core-modules/org-chart/utils/org-chart-resolve-domain.util';

export type CompanyEsDocument = {
  id?: string;
  name?: string;
  website?: string;
  industry?: string;
  location_name?: string;
  country?: string;
  locality?: string;
  region?: string;
  linkedin_url?: string;
  count_org?: number;
  size?: string;
  founded?: string;
  corporate_score?: number;
  is_org_chart?: boolean | string;
};

export type CompaniesEsSearchOptions = {
  query?: string;
  companyName?: string;
  companyId?: string;
  website?: string;
  industry?: string;
  limit?: number;
  offset?: number;
};

export type CompaniesEsSearchResult = {
  total: number;
  items: CompanyEsDocument[];
  index: string;
};

const COMPANY_SOURCE_FIELDS = [
  'id',
  'name',
  'website',
  'industry',
  'country',
  'locality',
  'region',
  'linkedin_url',
  'count_org',
  'size',
  'founded',
  'corporate_score',
  'is_org_chart',
] as const;

@Injectable()
export class CompaniesEsService {
  private readonly logger = new Logger(CompaniesEsService.name);
  private readonly client: Client | null;
  private readonly primaryIndex: string;
  private readonly companiesSearchIndex: string;
  private readonly companiesLegacyIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    this.primaryIndex = this.environmentService.get(
      'FREE_COMPANY_DATASET_ES_INDEX',
    );
    this.companiesSearchIndex = this.environmentService.get(
      'COMPANIES_SCORES_ES_INDEX',
    );
    this.companiesLegacyIndex = this.environmentService.get('COMPANIES_ES_INDEX');

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({ node: endpoint });
      this.logger.log(
        `Companies Elasticsearch client configured primary="${this.primaryIndex}" fallback="${this.companiesSearchIndex}" (legacy "${this.companiesLegacyIndex}")`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, companies ES queries are disabled',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getIndexName(): string {
    return this.primaryIndex;
  }

  getFallbackIndexName(): string {
    return this.companiesSearchIndex;
  }

  getLegacyIndexName(): string {
    return this.companiesLegacyIndex;
  }

  async searchCompanies(
    options: CompaniesEsSearchOptions,
  ): Promise<CompaniesEsSearchResult> {
    if (!this.client) {
      return { total: 0, items: [], index: this.primaryIndex };
    }

    const primary = await this.searchIndex(this.primaryIndex, options);
    if (primary.items.length > 0) {
      return primary;
    }

    if (this.companiesSearchIndex !== this.primaryIndex) {
      const fallback = await this.searchIndex(
        this.companiesSearchIndex,
        options,
      );
      if (fallback.items.length > 0) {
        return fallback;
      }
    }

    return primary;
  }

  private async searchIndex(
    index: string,
    options: CompaniesEsSearchOptions,
  ): Promise<CompaniesEsSearchResult> {
    if (!this.client) {
      return { total: 0, items: [], index };
    }

    const {
      query,
      companyName,
      companyId,
      website,
      industry,
      limit,
      offset,
    } = options;

    const mustClauses: Record<string, unknown>[] = [];
    const shouldClauses: Record<string, unknown>[] = [];

    const normalizedCompanyId = companyId?.trim().toLowerCase();
    if (normalizedCompanyId) {
      mustClauses.push({ term: { id: normalizedCompanyId } });
    }

    const normalizedWebsite = website?.trim();
    if (normalizedWebsite) {
      const websiteVariants = buildCompanyWebsiteLookupVariants(
        normalizedWebsite,
      );
      const termsValues =
        websiteVariants.length > 0 ? websiteVariants : [normalizedWebsite];

      shouldClauses.push({ terms: { website: termsValues } });
      shouldClauses.push({ term: { website: normalizedWebsite } });
      shouldClauses.push({ match: { website: normalizedWebsite } });
    }

    const normalizedCompanyName = companyName?.trim();
    if (normalizedCompanyName) {
      shouldClauses.push({
        term: { 'name.keyword': normalizedCompanyName },
      });
      shouldClauses.push({
        match: {
          name: {
            query: normalizedCompanyName,
            operator: 'and',
          },
        },
      });
      shouldClauses.push({
        match_phrase: {
          name: {
            query: normalizedCompanyName,
            boost: 2,
          },
        },
      });
    }

    const normalizedIndustry = industry?.trim();
    if (normalizedIndustry) {
      mustClauses.push({ match: { industry: normalizedIndustry } });
    }

    const normalizedQuery = query?.trim();
    if (normalizedQuery) {
      shouldClauses.push({
        multi_match: {
          query: normalizedQuery,
          fields: [
            'name^4',
            'id^3',
            'website^2',
            'linkedin_url^2',
            'industry',
          ],
          type: 'best_fields',
          operator: 'and',
        },
      });
    }

    if (shouldClauses.length > 0) {
      mustClauses.push({
        bool: {
          should: shouldClauses,
          minimum_should_match: 1,
        },
      });
    }

    const esQuery =
      mustClauses.length > 0
        ? { bool: { must: mustClauses } }
        : { match_all: {} };

    const size =
      typeof limit === 'number' && limit > 0 ? Math.min(limit, 100) : 20;
    const from = typeof offset === 'number' && offset >= 0 ? offset : 0;

    try {
      this.logger.log(
        `Executing companies ES query index=${index} size=${size} from=${from}: ${JSON.stringify(
          esQuery,
        ).slice(0, 4000)}`,
      );

      const response = await this.client.search<CompanyEsDocument>({
        index,
        from,
        size,
        track_total_hits: true,
        query: esQuery,
        _source: [...COMPANY_SOURCE_FIELDS],
        sort: [
          { _score: { order: 'desc' } },
          { count_org: { order: 'desc', unmapped_type: 'long' } },
        ],
      });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const items = (response.hits.hits ?? [])
        .map((hit) => hit._source)
        .filter((src): src is CompanyEsDocument => !!src);

      this.logger.log(
        `Companies ES query index=${index} returned ${items.length} items (total=${total})`,
      );

      return { total, items, index };
    } catch (error) {
      this.logger.error(
        `Elasticsearch companies search failed index=${index}`,
        error as Error,
      );
      return { total: 0, items: [], index };
    }
  }
}
