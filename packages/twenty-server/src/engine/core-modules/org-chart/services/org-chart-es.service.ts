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

  /**
   * Get top 10 companies most commonly hired from (prior employers of people
   * who joined this company). Returns company ids, names, and websites for
   * linking to org charts and displaying logos.
   */
  async getTopHiredFromCompanies(
    companyId: string,
  ): Promise<{ id: string; name: string; website?: string }[]> {
    if (!this.client) {
      return [];
    }

    if (!companyId.trim()) {
      return [];
    }

    const companiesIndex =
      (this.environmentService.get('COMPANIES_ES_INDEX') as string | undefined) ??
      'companies_index_text';

    try {
      const searchResponse = await this.client.search<{
        id?: string;
        name?: string;
        website?: string;
        top_ten_before_companies?: string[];
      }>({
        index: companiesIndex,
        size: 1,
        query: {
          bool: {
            should: [
              { term: { id: companyId } },
              { term: { 'name.keyword': companyId } },
            ],
          },
        },
        _source: ['top_ten_before_companies', 'name'],
      });

      const hit = searchResponse.hits.hits[0];
      const topTen = hit?._source?.top_ten_before_companies;

      if (!Array.isArray(topTen) || topTen.length === 0) {
        return [];
      }

      const idsToFetch = topTen.slice(0, 10);

      const fetchResponse = await this.client.search<{
        id?: string;
        name?: string;
        website?: string;
      }>({
        index: companiesIndex,
        size: idsToFetch.length,
        query: { terms: { id: idsToFetch } },
        _source: ['id', 'name', 'website'],
      });

      const byId = new Map<string, { id: string; name: string; website?: string }>();
      for (const h of fetchResponse.hits.hits) {
        const src = h._source;
        if (!src?.id) continue;
        const id = String(src.id);
        const name =
          typeof src.name === 'string' && src.name.trim()
            ? src.name
            : id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        byId.set(id, {
          id,
          name,
          website: typeof src.website === 'string' ? src.website : undefined,
        });
      }

      return idsToFetch
        .map((id) => byId.get(id))
        .filter((c): c is { id: string; name: string; website?: string } => !!c);
    } catch (error) {
      this.logger.error(
        `Elasticsearch getTopHiredFromCompanies failed for companyId=${companyId}`,
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get all (country, type) combinations that exist in ES for a company.
   * Used by the sitemap to index all org chart URL variants.
   */
  async getIndexedUrlsForCompany(
    companyId: string,
  ): Promise<{ country: string; type: string }[]> {
    if (!this.client) {
      return [];
    }

    if (!companyId.trim()) {
      this.logger.warn('Empty companyId provided to getIndexedUrlsForCompany');
      return [];
    }

    const results: { country: string; type: string }[] = [];
    let after: Record<string, string | number> | undefined;

    try {
      do {
        const compositeAgg: Record<string, unknown> = {
          size: 500,
          sources: [
            { country: { terms: { field: 'country' } } },
            { type: { terms: { field: 'type' } } },
          ],
        };
        if (after) {
          compositeAgg.after = after;
        }

        const response = await this.client.search({
          index: this.orgChartsIndex,
          size: 0,
          query: {
            bool: {
              must: [{ match: { job_company_id: companyId } }],
            },
          },
          aggs: {
            combos: {
              composite: compositeAgg,
            },
          },
        });

        const agg = response.aggregations?.combos as
          | { buckets?: Array<{ key: { country: string; type: string } }>; after?: Record<string, string | number> }
          | undefined;
        const buckets = agg?.buckets ?? [];
        after = agg?.after;

        for (const bucket of buckets) {
          const country = bucket.key?.country ?? 'global';
          const type = bucket.key?.type ?? 'fullcompany';
          results.push({ country, type });
        }
      } while (after);

      this.logger.log(
        `getIndexedUrlsForCompany companyId=${companyId} found ${results.length} URL combinations`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Elasticsearch getIndexedUrlsForCompany failed for companyId=${companyId}`,
        error as Error,
      );
      return [];
    }
  }
}

