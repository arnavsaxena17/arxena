import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type PeopleDocument = Record<string, unknown>;

export type PeopleEsSearchOptions = {
  query?: string;
  personName?: string;
  jobTitle?: string;
  companyId?: string;
  companyName?: string;
  website?: string;
  stdFunction?: string;
  stdGrade?: string;
  country?: string;
  linkedinUrl?: string;
  limit?: number;
  offset?: number;
};

export type PeopleEsSearchResult = {
  total: number;
  items: PeopleDocument[];
};

@Injectable()
export class PeopleEsService {
  private readonly logger = new Logger(PeopleEsService.name);
  private readonly client: Client | null;
  private readonly peopleIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    this.peopleIndex = this.environmentService.get('PEOPLE_ES_INDEX');

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({
        node: endpoint,
      });
      this.logger.log(
        `People Elasticsearch client configured for index "${this.peopleIndex}"`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, people ES queries are disabled',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getIndexName(): string {
    return this.peopleIndex;
  }

  private normalizeCompanyId(companyId: string): string {
    return companyId.trim().toLowerCase();
  }

  private normalizeLinkedInUrl(url: string): string {
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .trim()
      .toLowerCase();
  }

  private buildPeopleSearchQuery(
    options: PeopleEsSearchOptions,
  ): Record<string, unknown> {
    const {
      query,
      personName,
      jobTitle,
      companyId,
      companyName,
      website,
      stdFunction,
      stdGrade,
      country,
      linkedinUrl,
    } = options;

    const mustClauses: Record<string, unknown>[] = [];
    const shouldClauses: Record<string, unknown>[] = [];

    const normalizedCompanyId = companyId
      ? this.normalizeCompanyId(companyId)
      : '';
    const normalizedCompanyName = companyName?.trim().toLowerCase();

    const companyShould: Record<string, unknown>[] = [];
    if (normalizedCompanyId) {
      companyShould.push({ match: { job_company_id: normalizedCompanyId } });
    }
    if (normalizedCompanyName) {
      companyShould.push({ match: { job_company_name: normalizedCompanyName } });
    }
    if (website?.trim()) {
      companyShould.push({ match: { job_company_website: website.trim() } });
    }
    if (companyShould.length > 0) {
      mustClauses.push({ bool: { should: companyShould } });
    }

    const nodeMust: Record<string, unknown>[] = [];
    if (stdFunction?.trim()) {
      nodeMust.push({ match: { std_functions: stdFunction.trim() } });
    }
    if (stdGrade?.trim()) {
      nodeMust.push({ match: { std_grades: stdGrade.trim() } });
    }
    if (country?.trim()) {
      nodeMust.push({ match: { location_country: country.trim() } });
    }
    if (personName?.trim()) {
      nodeMust.push({ match: { full_name: personName.trim() } });
    }
    if (jobTitle?.trim()) {
      nodeMust.push({ match: { job_title: jobTitle.trim() } });
    }
    if (linkedinUrl?.trim()) {
      nodeMust.push({
        match: { linkedin_url: this.normalizeLinkedInUrl(linkedinUrl) },
      });
    }
    if (nodeMust.length > 0) {
      mustClauses.push({ bool: { must: nodeMust } });
    }

    if (query?.trim()) {
      shouldClauses.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'full_name^3',
            'job_title^2',
            'job_company_name^2',
            'std_functions',
            'location_country',
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

    return mustClauses.length > 0
      ? { bool: { must: mustClauses } }
      : { match_all: {} };
  }

  async searchPeople(
    options: PeopleEsSearchOptions,
  ): Promise<PeopleEsSearchResult> {
    if (!this.client) {
      return { total: 0, items: [] };
    }

    const query = this.buildPeopleSearchQuery(options);
    const size =
      typeof options.limit === 'number' && options.limit > 0
        ? Math.min(options.limit, 100)
        : 20;
    const from =
      typeof options.offset === 'number' && options.offset >= 0
        ? options.offset
        : 0;

    try {
      this.logger.log(
        `Executing people ES query index=${this.peopleIndex} size=${size} from=${from}: ${JSON.stringify(
          query,
        ).slice(0, 4000)}`,
      );

      const response = await this.client.search<PeopleDocument>({
        index: this.peopleIndex,
        from,
        size,
        track_total_hits: true,
        query,
        _source: [
          'full_name',
          'job_title',
          'job_company_name',
          'job_company_id',
          'job_company_website',
          'location_country',
          'std_functions',
          'std_grades',
          'linkedin_url',
          'emails',
          'phone_numbers',
        ],
      });

      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : (response.hits.total?.value ?? 0);

      const items = (response.hits.hits ?? [])
        .map((hit) => hit._source)
        .filter((src): src is PeopleDocument => !!src);

      this.logger.log(
        `People ES query returned ${items.length} items (total=${total})`,
      );

      return { total, items };
    } catch (error) {
      this.logger.error('Elasticsearch people search failed', error as Error);
      return { total: 0, items: [] };
    }
  }

  async searchForOrgChartNode(options: {
    companyId: string;
    companyName?: string;
    website?: string;
    stdFunction?: string;
    stdGrade?: string;
    country?: string;
    limit?: number;
  }): Promise<PeopleDocument[]> {
    const result = await this.searchPeople({
      companyId: options.companyId,
      companyName: options.companyName,
      website: options.website,
      stdFunction: options.stdFunction,
      stdGrade: options.stdGrade,
      country: options.country,
      limit: options.limit ?? 50,
    });

    return result.items;
  }
}
