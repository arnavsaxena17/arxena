import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type OrgChartDocument = Record<string, unknown>;

@Injectable()
export class OrgChartEsService {
  private readonly logger = new Logger(OrgChartEsService.name);
  private readonly client: Client | null;
  private readonly orgChartsIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    const index =
      (this.environmentService.get('ORGCHARTS_ES_INDEX') as string | undefined) ??
      'org-charts-all';

    this.orgChartsIndex = index;

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({
        node: endpoint,
      });
      this.logger.log(
        `Org charts Elasticsearch client configured for index "${this.orgChartsIndex}"`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, org chart ES queries are disabled',
      );
    }
  }

  async getOrgChartByCompanyId(
    companyId: string,
    options?: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
    },
  ): Promise<OrgChartDocument | null> {
    if (!this.client) {
      return null;
    }

    if (!companyId.trim()) {
      this.logger.warn('Empty companyId provided to getOrgChartByCompanyId');
      return null;
    }

    const {
      companyName,
      website,
      country: countryOverride,
      functionRoot,
    } = options ?? {};

    const shouldClauses: Record<string, unknown>[] = [
      {
        match: {
          // Mirrors ESOrgQueryGenerator.create_es_query_orgcharts_job_company_name
          job_company_id: companyId,
        },
      },
    ];

    if (companyName && companyName.trim().length > 0) {
      shouldClauses.push({
        match: {
          job_company_name: companyName.trim(),
        },
      });
    }

    if (website && website.trim().length > 0) {
      shouldClauses.push({
        match: {
          job_company_website: website.trim(),
        },
      });
    }

    const mustClauses: Record<string, unknown>[] = [];

    if (shouldClauses.length > 0) {
      mustClauses.push({
        bool: {
          should: shouldClauses,
        },
      });
    }

    const countryValue =
      countryOverride && countryOverride.trim().length > 0
        ? countryOverride.trim()
        : 'global';

    mustClauses.push({
      match: {
        // Mirrors ESOrgQueryGenerator.create_es_query_orgcharts_locations
        country: countryValue,
      },
    });

    const typeValue =
      functionRoot && functionRoot.trim().length > 0
        ? functionRoot.trim()
        : 'fullcompany';

    mustClauses.push({
      match: {
        // Mirrors ESOrgQueryGenerator.create_es_query_orgcharts_type
        type: typeValue,
      },
    });

    const query = {
      bool: {
        must: mustClauses,
      },
    };

    try {
      this.logger.log(
        `Executing org chart ES query for companyId=${companyId}, companyName=${companyName ?? ''}, website=${website ?? ''}, country=${countryValue}, type=${typeValue}: ${JSON.stringify(
          query,
        ).slice(0, 4000)}`,
      );

      const response = await this.client.search<OrgChartDocument>({
        index: this.orgChartsIndex,
        // keep result set small; Python version also fetches a single doc
        size: 5,
        track_total_hits: true,
        query,
      });

      const firstHit = response.hits.hits[0];

      if (!firstHit?._source) {
        this.logger.warn(
          `No org chart document found in ES for companyId=${companyId}`,
        );
        return null;
      }

      this.logger.log(
        `Org chart ES query succeeded for companyId=${companyId}, totalHits=${JSON.stringify(
          response.hits.total,
        )}`,
      );

      return firstHit._source;
    } catch (error) {
      this.logger.error(
        `Elasticsearch org chart query failed for companyId=${companyId}`,
        error as Error,
      );
      return null;
    }
  }
}

