import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
    CoreSignalCompanyRef,
    CoreSignalEmployeeApi,
    OrgMovementWindowId,
    PersonOrgMovementResult,
    PersonOrgMovementWindowResult,
} from './person-org-movement.types';

type CoreSignalEndpoints = {
  esDsl: string;
  preview: string;
  collect: string;
};

const CORESIGNAL_ENDPOINTS: Record<CoreSignalEmployeeApi, CoreSignalEndpoints> =
  {
    multi_source: {
      esDsl:
        'https://api.coresignal.com/cdapi/v2/employee_multi_source/search/es_dsl',
      preview:
        'https://api.coresignal.com/cdapi/v2/employee_multi_source/search/es_dsl/preview',
      collect:
        'https://api.coresignal.com/cdapi/v2/employee_multi_source/collect',
    },
    employee_base: {
      esDsl:
        'https://api.coresignal.com/cdapi/v2/employee_base/search/es_dsl',
      preview:
        'https://api.coresignal.com/cdapi/v2/employee_base/search/es_dsl/preview',
      collect: 'https://api.coresignal.com/cdapi/v2/employee_base/collect',
    },
  };

/** Same relative windows as PDL for comparable reporting. */
const WINDOW_DAYS: Record<OrgMovementWindowId, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const DEFAULT_MAX_NAMES_PER_DIRECTION = 100;

function formatDateTimeStart(isoDate: string): string {
  return `${isoDate}T00:00:00.000000`;
}

function formatDateTimeEnd(isoDate: string): string {
  return `${isoDate}T23:59:59.999999`;
}

function parseTotalResults(headers: Headers): number {
  const raw =
    headers.get('x-total-results') ?? headers.get('X-Total-Results') ?? '0';

  const n = Number.parseInt(raw, 10);

  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class CoreSignalPersonOrgMovementService {
  private readonly logger = new Logger(CoreSignalPersonOrgMovementService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const key = this.environmentService.get('CORESIGNAL_API_KEY');

    return typeof key === 'string' && key.length > 0;
  }

  private getApiKey(): string | undefined {
    const key = this.environmentService.get('CORESIGNAL_API_KEY');

    return typeof key === 'string' && key.length > 0 ? key : undefined;
  }

  /**
   * Elasticsearch DSL on [multi-source](https://docs.coresignal.com/employee-api/multi-source-employee-api/elasticsearch-dsl)
   * or [base employee](https://docs.coresignal.com/employee-api/base-employee-api/endpoints/elasticsearch-dsl) indexes,
   * with preview for names and collect by id/URL.
   * - **Joined**: nested `experience_recently_started` for the company with `identification_date` in range.
   * - **Left**: nested `experience_recently_closed` for the company with `identification_date` in range.
   * - **Experience changed**: `experience_change_last_identified_at` in range while still at the company
   *   (`active_experience_company_id` or nested active `experience` row by `company_name.exact`).
   */
  async getOrgJoinLeaveMovement(
    company: CoreSignalCompanyRef,
    options?: {
      referenceDate?: Date;
      windows?: OrgMovementWindowId[];
      maxNamesPerDirection?: number;
      /** Overrides `CORESIGNAL_EMPLOYEE_API`; default `multi_source`. */
      employeeApi?: CoreSignalEmployeeApi;
    },
  ): Promise<PersonOrgMovementResult> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('CORESIGNAL_API_KEY is not configured');
    }

    const employeeApi = this.resolveEmployeeApi(options?.employeeApi);
    const endpoints = CORESIGNAL_ENDPOINTS[employeeApi];

    const referenceDate = options?.referenceDate ?? new Date();
    const windowIds = options?.windows ?? ['1w', '1m', '3m', '6m', '1y'];
    const maxNames =
      options?.maxNamesPerDirection ?? DEFAULT_MAX_NAMES_PER_DIRECTION;

    const endDate = referenceDate.toISOString().slice(0, 10);
    const results: PersonOrgMovementWindowResult[] = [];

    for (const windowId of windowIds) {
      const days = WINDOW_DAYS[windowId];
      const start = new Date(referenceDate);

      start.setUTCDate(start.getUTCDate() - days);
      const startDate = start.toISOString().slice(0, 10);

      const joined = await this.runBucket({
        apiKey,
        endpoints,
        company,
        startDate,
        endDate,
        maxNames,
        kind: 'joined',
      });

      const left = await this.runBucket({
        apiKey,
        endpoints,
        company,
        startDate,
        endDate,
        maxNames,
        kind: 'left',
      });

      const experienceChanged = await this.runBucket({
        apiKey,
        endpoints,
        company,
        startDate,
        endDate,
        maxNames,
        kind: 'experienceChanged',
      });

      results.push({
        window: windowId,
        range: { startDate, endDate },
        joined,
        left,
        experienceChanged,
      });
    }

    return { source: 'coresignal', windows: results };
  }

  private resolveEmployeeApi(
    override?: CoreSignalEmployeeApi,
  ): CoreSignalEmployeeApi {
    if (override === 'multi_source' || override === 'employee_base') {
      return override;
    }

    const fromEnv = this.environmentService.get('CORESIGNAL_EMPLOYEE_API');

    if (fromEnv === 'multi_source' || fromEnv === 'employee_base') {
      return fromEnv;
    }

    return 'multi_source';
  }

  private async runBucket(params: {
    apiKey: string;
    endpoints: CoreSignalEndpoints;
    company: CoreSignalCompanyRef;
    startDate: string;
    endDate: string;
    maxNames: number;
    kind: 'joined' | 'left' | 'experienceChanged';
  }): Promise<{ total: number; names: string[] }> {
    const query = this.buildQuery(params);

    const body: Record<string, unknown> = {
      query,
      sort: ['id'],
    };

    const total = await this.fetchTotal(
      params.apiKey,
      params.endpoints.esDsl,
      body,
    );
    const names = await this.fetchNamesPreview(
      params.apiKey,
      params.endpoints.preview,
      body,
      params.maxNames,
    );

    return { total, names };
  }

  private buildQuery(params: {
    company: CoreSignalCompanyRef;
    startDate: string;
    endDate: string;
    kind: 'joined' | 'left' | 'experienceChanged';
  }): Record<string, unknown> {
    const gte = formatDateTimeStart(params.startDate);
    const lte = formatDateTimeEnd(params.endDate);

    if (params.kind === 'experienceChanged') {
      return this.buildExperienceChangedQuery(params.company, gte, lte);
    }

    const path =
      params.kind === 'joined'
        ? 'experience_recently_started'
        : 'experience_recently_closed';

    const nestedMust: Record<string, unknown>[] = [
      {
        range: {
          identification_date: { gte, lte },
        },
      },
    ];

    if ('companyId' in params.company) {
      nestedMust.unshift({
        term: { company_id: params.company.companyId },
      });
    } else {
      nestedMust.unshift({
        term: {
          'company_name.exact': params.company.companyNameExact,
        },
      });
    }

    return {
      nested: {
        path,
        query: {
          bool: {
            must: nestedMust,
          },
        },
      },
    };
  }

  private buildExperienceChangedQuery(
    company: CoreSignalCompanyRef,
    gte: string,
    lte: string,
  ): Record<string, unknown> {
    const rangeClause = {
      range: {
        experience_change_last_identified_at: {
          gte: gte.slice(0, 10),
          lte: lte.slice(0, 10),
        },
      },
    };

    if ('companyId' in company) {
      return {
        bool: {
          must: [
            { term: { active_experience_company_id: company.companyId } },
            rangeClause,
          ],
        },
      };
    }

    return {
      bool: {
        must: [
          {
            nested: {
              path: 'experience',
              query: {
                bool: {
                  must: [
                    { term: { active_experience: 1 } },
                    {
                      term: {
                        'company_name.exact': company.companyNameExact,
                      },
                    },
                  ],
                },
              },
            },
          },
          rangeClause,
        ],
      },
    };
  }

  private async fetchTotal(
    apiKey: string,
    esDslUrl: string,
    body: Record<string, unknown>,
  ): Promise<number> {
    const url = new URL(esDslUrl);

    url.searchParams.set('items_per_page', '1');

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          apikey: apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();

        this.logger.warn(
          `CoreSignal es_dsl HTTP ${response.status}: ${text.slice(0, 500)}`,
        );

        return 0;
      }

      return parseTotalResults(response.headers);
    } catch (error) {
      this.logger.error('CoreSignal es_dsl total request failed', error);

      return 0;
    }
  }

  private async fetchNamesPreview(
    apiKey: string,
    previewUrl: string,
    body: Record<string, unknown>,
    maxNames: number,
  ): Promise<string[]> {
    const names: string[] = [];
    let page = 1;

    try {
      while (names.length < maxNames) {
        const pageSize = Math.min(1000, maxNames - names.length);
        const url = new URL(previewUrl);

        url.searchParams.set('page', String(page));
        url.searchParams.set('items_per_page', String(pageSize));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            apikey: apiKey,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text();

          this.logger.warn(
            `CoreSignal preview HTTP ${response.status}: ${text.slice(0, 500)}`,
          );
          break;
        }

        const json: unknown = await response.json();
        const rows = Array.isArray(json) ? json : [];

        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          if (
            typeof row === 'object' &&
            row !== null &&
            'full_name' in row &&
            typeof (row as { full_name: unknown }).full_name === 'string'
          ) {
            const n = (row as { full_name: string }).full_name.trim();

            if (n) {
              names.push(n);
            }
          }
          if (names.length >= maxNames) {
            break;
          }
        }

        if (rows.length < pageSize) {
          break;
        }

        page += 1;
      }
    } catch (error) {
      this.logger.error('CoreSignal preview pagination failed', error);
    }

    return names.slice(0, maxNames);
  }

  /**
   * Collect full profile by CoreSignal employee id or profile URL / shorthand.
   * Uses [multi-source](https://api.coresignal.com/cdapi/v2/employee_multi_source/collect/…) or
   * [base](https://api.coresignal.com/cdapi/v2/employee_base/collect/…) collect per `employeeApi` / env.
   */
  async collectMultiSourceEmployee(
    lookup: { employeeId: number } | { profileUrlOrShorthand: string },
    options?: {
      fields?: string[];
      /** Overrides `CORESIGNAL_EMPLOYEE_API`; default `multi_source`. */
      employeeApi?: CoreSignalEmployeeApi;
    },
  ): Promise<unknown> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('CORESIGNAL_API_KEY is not configured');
    }

    const employeeApi = this.resolveEmployeeApi(options?.employeeApi);
    const collectBase = CORESIGNAL_ENDPOINTS[employeeApi].collect;

    const pathSegment =
      'employeeId' in lookup
        ? String(lookup.employeeId)
        : encodeURIComponent(lookup.profileUrlOrShorthand.trim());

    const url = new URL(`${collectBase}/${pathSegment}`);

    if (options?.fields?.length) {
      for (const f of options.fields) {
        url.searchParams.append('fields', f);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: apiKey,
      },
    });

    const json: unknown = await response.json();

    if (!response.ok) {
      this.logger.warn(
        `CoreSignal collect HTTP ${response.status}: ${JSON.stringify(json)}`,
      );
    }

    return json;
  }
}
