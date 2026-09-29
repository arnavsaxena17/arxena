import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';
import { isNonEmptyString } from '@sniptt/guards';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { buildResolveCompanyFromRawNameQuery } from 'src/engine/core-modules/org-chart/utils/build-resolve-company-from-raw-name-query.util';
import { cleanRawCompanyName } from 'src/engine/core-modules/org-chart/utils/clean-raw-company-name.util';
import {
  pickBestCompanyNameHit,
  type CompanyNameResolverEsHit,
} from 'src/engine/core-modules/org-chart/utils/pick-best-company-name-hit.util';

const COMPANY_NAME_RESOLVER_SOURCE_FIELDS = [
  'count_org',
  'country',
  'founded',
  'id',
  'industry',
  'is_org_chart',
  'linkedin_url',
  'name',
  'size',
  'website',
  'corporate_score',
] as const;

const DEFAULT_RESOLVE_SIZE = 20;
const DEFAULT_CONCURRENCY = 5;
const MAX_BATCH_SIZE = 50;

export type ResolvedCompanyFromRawName = {
  rawCompanyName: string;
  cleanedQuery: string;
  resolved: boolean;
  name: string | null;
  id: string | null;
  website: string | null;
  industry: string | null;
  country: string | null;
  linkedinUrl: string | null;
  countOrg: number | null;
  size: string | null;
  founded: string | null;
  corporateScore: number | null;
  isOrgChart: boolean | string | null;
  editDistance: number | null;
  durationMs: number;
};

@Injectable()
export class CompanyNameResolverService {
  private readonly logger = new Logger(CompanyNameResolverService.name);
  private readonly client: Client | null;
  private readonly indexName: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');

    this.indexName = this.environmentService.get('COMPANIES_SCORES_ES_INDEX');

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({ node: endpoint });
      this.logger.log(
        `Company name resolver ES client configured index="${this.indexName}"`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, company name resolver is disabled',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getIndexName(): string {
    return this.indexName;
  }

  cleanRawCompanyName(rawCompanyName: string): string {
    return cleanRawCompanyName(rawCompanyName);
  }

  buildResolveQuery(cleanedCompanyName: string): Record<string, unknown> {
    return buildResolveCompanyFromRawNameQuery(cleanedCompanyName);
  }

  async resolveFromRawCompanyName(
    rawCompanyName: string,
  ): Promise<ResolvedCompanyFromRawName> {
    const startedAt = Date.now();
    const trimmedRaw = rawCompanyName?.trim() ?? '';

    if (!isNonEmptyString(trimmedRaw)) {
      return this.emptyResult({
        rawCompanyName: trimmedRaw,
        cleanedQuery: '',
        durationMs: Date.now() - startedAt,
      });
    }

    const cleanedQuery = cleanRawCompanyName(trimmedRaw);

    if (!isNonEmptyString(cleanedQuery) || !this.client) {
      return this.emptyResult({
        rawCompanyName: trimmedRaw,
        cleanedQuery,
        durationMs: Date.now() - startedAt,
      });
    }

    try {
      const response = await this.client.search({
        index: this.indexName,
        size: DEFAULT_RESOLVE_SIZE,
        _source: [...COMPANY_NAME_RESOLVER_SOURCE_FIELDS],
        query: this.buildResolveQuery(cleanedQuery),
      });

      const hits = (response.hits?.hits ?? []) as CompanyNameResolverEsHit[];
      const picked = pickBestCompanyNameHit(cleanedQuery, hits);

      if (!picked) {
        return this.emptyResult({
          rawCompanyName: trimmedRaw,
          cleanedQuery,
          durationMs: Date.now() - startedAt,
        });
      }

      const source = picked.source;

      return {
        rawCompanyName: trimmedRaw,
        cleanedQuery,
        resolved: true,
        name: source.name ?? null,
        id: source.id ?? null,
        website: source.website ?? null,
        industry: source.industry ?? null,
        country: source.country ?? null,
        linkedinUrl: source.linkedin_url ?? null,
        countOrg:
          typeof source.count_org === 'number' ? source.count_org : null,
        size: source.size ?? null,
        founded: source.founded ?? null,
        corporateScore:
          typeof source.corporate_score === 'number'
            ? source.corporate_score
            : null,
        isOrgChart: source.is_org_chart ?? null,
        editDistance: picked.editDistance,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.error(
        `Company name resolve failed for "${trimmedRaw}"`,
        error instanceof Error ? error.stack : String(error),
      );

      return this.emptyResult({
        rawCompanyName: trimmedRaw,
        cleanedQuery,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  async resolveMany(
    rawCompanyNames: string[],
    concurrency: number = DEFAULT_CONCURRENCY,
  ): Promise<ResolvedCompanyFromRawName[]> {
    const names = rawCompanyNames
      .map((name) => name?.trim() ?? '')
      .filter(isNonEmptyString)
      .slice(0, MAX_BATCH_SIZE);

    if (names.length === 0) {
      return [];
    }

    const limit = Math.max(1, Math.min(concurrency, DEFAULT_CONCURRENCY));
    const results: ResolvedCompanyFromRawName[] = new Array(names.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(limit, names.length) }, async () => {
      while (nextIndex < names.length) {
        const currentIndex = nextIndex;

        nextIndex += 1;
        results[currentIndex] = await this.resolveFromRawCompanyName(
          names[currentIndex],
        );
      }
    });

    await Promise.all(workers);

    return results;
  }

  private emptyResult({
    rawCompanyName,
    cleanedQuery,
    durationMs,
  }: {
    rawCompanyName: string;
    cleanedQuery: string;
    durationMs: number;
  }): ResolvedCompanyFromRawName {
    return {
      rawCompanyName,
      cleanedQuery,
      resolved: false,
      name: null,
      id: null,
      website: null,
      industry: null,
      country: null,
      linkedinUrl: null,
      countOrg: null,
      size: null,
      founded: null,
      corporateScore: null,
      isOrgChart: null,
      editDistance: null,
      durationMs,
    };
  }
}
