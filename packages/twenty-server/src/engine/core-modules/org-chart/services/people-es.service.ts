import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type PeopleDocument = Record<string, unknown>;

@Injectable()
export class PeopleEsService {
  private readonly logger = new Logger(PeopleEsService.name);
  private readonly client: Client | null;
  private readonly peopleIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    const index =
      (this.environmentService.get('PEOPLE_ES_INDEX') as string | undefined) ??
      'people_all';

    this.peopleIndex = index;

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
        'PEOPLE_ES_ENDPOINT not configured, people ES queries are disabled',
      );
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
    if (!this.client) {
      return [];
    }

    const {
      companyId,
      companyName,
      website,
      stdFunction,
      stdGrade,
      country,
      limit,
    } = options;

    if (!companyId.trim() && !companyName && !website) {
      this.logger.warn(
        'searchForOrgChartNode called without a usable company identifier',
      );
      return [];
    }

    const mustClauses: Record<string, unknown>[] = [];

    const companyShould: Record<string, unknown>[] = [];

    if (companyId.trim()) {
      companyShould.push({
        match: {
          job_company_id: companyId.trim(),
        },
      });
    }

    if (companyName && companyName.trim().length > 0) {
      companyShould.push({
        match: {
          job_company_name: companyName.trim(),
        },
      });
    }

    if (website && website.trim().length > 0) {
      companyShould.push({
        match: {
          job_company_website: website.trim(),
        },
      });
    }

    if (companyShould.length > 0) {
      mustClauses.push({
        bool: {
          should: companyShould,
        },
      });
    }

    const nodeMust: Record<string, unknown>[] = [];

    if (stdFunction && stdFunction.trim().length > 0) {
      // ES people docs store standardized functions in the std_functions array
      nodeMust.push({
        match: {
          std_functions: stdFunction.trim(),
        },
      });
    }

    if (stdGrade && stdGrade.trim().length > 0) {
      // ES people docs store standardized grades in the std_grades array
      nodeMust.push({
        match: {
          std_grades: stdGrade.trim(),
        },
      });
    }

    if (country && country.trim().length > 0) {
      // People index uses location_country instead of country
      nodeMust.push({
        match: {
          location_country: country.trim(),
        },
      });
    }

    if (nodeMust.length > 0) {
      mustClauses.push({
        bool: {
          must: nodeMust,
        },
      });
    }

    const query =
      mustClauses.length > 0
        ? {
            bool: {
              must: mustClauses,
            },
          }
        : { match_all: {} };

    const size = typeof limit === 'number' && limit > 0 ? limit : 50;

    try {
      this.logger.log(
        `Executing people ES query for orgchart node, companyId=${companyId}, stdFunction=${stdFunction ?? ''}, stdGrade=${stdGrade ?? ''}, country=${country ?? ''}: ${JSON.stringify(
          query,
        ).slice(0, 4000)}`,
      );

      console.log('people ES query', JSON.stringify(query, null, 2));
      console.log('people ES index', this.peopleIndex);
      const response = await this.client.search<PeopleDocument>({
        index: this.peopleIndex,
        size,
        track_total_hits: true,
        query,
      });
      console.log('people ES query response', JSON.stringify(response, null, 2));
      const hits = response.hits.hits ?? [];
      const items = hits
        .map((hit) => hit._source)
        .filter((src): src is PeopleDocument => !!src);

      this.logger.log(
        `People ES query for orgchart node returned ${items.length} items (totalHits=${JSON.stringify(
          response.hits.total,
        )})`,
      );

      return items;
    } catch (error) {
      this.logger.error(
        'Elasticsearch people query for orgchart node failed',
        error as Error,
      );
      return [];
    }
  }
}

