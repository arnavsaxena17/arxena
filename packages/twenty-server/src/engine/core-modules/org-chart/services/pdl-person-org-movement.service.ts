import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
    OrgMovementWindowId,
    PdlCompanyRef,
    PersonOrgMovementResult,
    PersonOrgMovementWindowResult,
} from './person-org-movement.types';

const PDL_PERSON_SEARCH_URL = 'https://api.peopledatalabs.com/v5/person/search';

type PdlSearchResponse = {
  status?: number;
  total?: number;
  data?: Array<{ full_name?: string }>;
  scroll_token?: string | null;
  error?: { message?: string; type?: string };
};

/** Approximate calendar-relative windows (PDL dates are often month-precision). */
const WINDOW_DAYS: Record<OrgMovementWindowId, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const DEFAULT_MAX_NAMES_PER_DIRECTION = 100;

function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

@Injectable()
export class PdlPersonOrgMovementService {
  private readonly logger = new Logger(PdlPersonOrgMovementService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const key = this.environmentService.get('PDL_API_KEY');

    return typeof key === 'string' && key.length > 0;
  }

  private getApiKey(): string | undefined {
    const key = this.environmentService.get('PDL_API_KEY');

    return typeof key === 'string' && key.length > 0 ? key : undefined;
  }

  /**
   * Uses [Person Search API](https://docs.peopledatalabs.com/docs/person-search-api).
   * - **Joined**: current role at the company with `job_start_date` in the window.
   * - **Left**: past role with `experience.end_date` in the window (SQL).
   * - **Experience changed**: current job at the company with `job_last_changed` in the window (role/profile updates).
   */
  async getOrgJoinLeaveMovement(
    company: PdlCompanyRef,
    options?: {
      referenceDate?: Date;
      windows?: OrgMovementWindowId[];
      maxNamesPerDirection?: number;
      titlecase?: boolean;
    },
  ): Promise<PersonOrgMovementResult> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error('PDL_API_KEY is not configured');
    }

    const referenceDate = options?.referenceDate ?? new Date();
    const windowIds = options?.windows ?? ['1w', '1m', '3m', '6m', '1y'];
    const maxNames =
      options?.maxNamesPerDirection ?? DEFAULT_MAX_NAMES_PER_DIRECTION;
    const titlecase = options?.titlecase ?? true;

    const endDate = formatDateOnly(referenceDate);
    const results: PersonOrgMovementWindowResult[] = [];

    for (const windowId of windowIds) {
      const days = WINDOW_DAYS[windowId];
      const start = new Date(referenceDate);

      start.setUTCDate(start.getUTCDate() - days);
      const startDate = formatDateOnly(start);

      const joined = await this.searchJoined({
        apiKey,
        company,
        startDate,
        endDate,
        maxNames,
        titlecase,
      });

      const left = await this.searchLeft({
        apiKey,
        company,
        startDate,
        endDate,
        maxNames,
        titlecase,
      });

      const experienceChanged = await this.searchExperienceChanged({
        apiKey,
        company,
        startDate,
        endDate,
        maxNames,
        titlecase,
      });

      results.push({
        window: windowId,
        range: { startDate, endDate },
        joined,
        left,
        experienceChanged,
      });
    }

    return { source: 'pdl', windows: results };
  }

  private async searchJoined(params: {
    apiKey: string;
    company: PdlCompanyRef;
    startDate: string;
    endDate: string;
    maxNames: number;
    titlecase: boolean;
  }): Promise<{ total: number; names: string[] }> {
    const companyClause =
      typeof params.company.jobCompanyId === 'string'
        ? { term: { job_company_id: params.company.jobCompanyId } }
        : {
            term: {
              job_company_name: params.company.jobCompanyName
                .trim()
                .toLowerCase(),
            },
          };

    const body = {
      query: {
        bool: {
          must: [
            companyClause,
            {
              range: {
                job_start_date: {
                  gte: params.startDate,
                  lte: params.endDate,
                },
              },
            },
          ],
        },
      },
      titlecase: params.titlecase,
      data_include: 'full_name,id',
    };

    return this.collectNamesAndTotal(params.apiKey, body, params.maxNames);
  }

  private async searchLeft(params: {
    apiKey: string;
    company: PdlCompanyRef;
    startDate: string;
    endDate: string;
    maxNames: number;
    titlecase: boolean;
  }): Promise<{ total: number; names: string[] }> {
    let companySql: string;

    if (typeof params.company.jobCompanyId === 'string') {
      companySql = `experience.company.id = '${escapeSqlString(params.company.jobCompanyId)}'`;
    } else {
      companySql = `experience.company.name = '${escapeSqlString(
        params.company.jobCompanyName.trim().toLowerCase(),
      )}'`;
    }

    const sql = `
SELECT * FROM person
WHERE ${companySql}
AND experience.end_date IS NOT NULL
AND experience.end_date >= '${params.startDate}'
AND experience.end_date <= '${params.endDate}'
`.trim();

    const body = {
      sql,
      titlecase: params.titlecase,
      data_include: 'full_name,id',
    };

    return this.collectNamesAndTotal(params.apiKey, body, params.maxNames);
  }

  private async searchExperienceChanged(params: {
    apiKey: string;
    company: PdlCompanyRef;
    startDate: string;
    endDate: string;
    maxNames: number;
    titlecase: boolean;
  }): Promise<{ total: number; names: string[] }> {
    const companyClause =
      typeof params.company.jobCompanyId === 'string'
        ? { term: { job_company_id: params.company.jobCompanyId } }
        : {
            term: {
              job_company_name: params.company.jobCompanyName
                .trim()
                .toLowerCase(),
            },
          };

    const body = {
      query: {
        bool: {
          must: [
            companyClause,
            {
              range: {
                job_last_changed: {
                  gte: params.startDate,
                  lte: params.endDate,
                },
              },
            },
          ],
        },
      },
      titlecase: params.titlecase,
      data_include: 'full_name,id',
    };

    return this.collectNamesAndTotal(params.apiKey, body, params.maxNames);
  }

  private async collectNamesAndTotal(
    apiKey: string,
    body: Record<string, unknown>,
    maxNames: number,
  ): Promise<{ total: number; names: string[] }> {
    const names: string[] = [];
    let total = 0;
    let scrollToken: string | null | undefined;

    let remaining = Math.min(maxNames, 10000);

    do {
      const batchSize = Math.min(100, remaining);
      const payload: Record<string, unknown> = {
        ...body,
        size: batchSize,
      };

      if (scrollToken) {
        payload.scroll_token = scrollToken;
      }

      const json = await this.postSearch(apiKey, payload);

      if (json.status !== 200) {
        this.logger.warn(
          `PDL person search non-200 status ${json.status}: ${JSON.stringify(json.error ?? json)}`,
        );
        break;
      }

      total = json.total ?? 0;
      const batch = json.data ?? [];

      for (const row of batch) {
        const n = row.full_name?.trim();

        if (n) {
          names.push(n);
        }
      }
      remaining -= batch.length;
      scrollToken = json.scroll_token ?? null;
      if (!scrollToken || batch.length === 0 || remaining <= 0) {
        break;
      }
    } while (names.length < maxNames && remaining > 0);

    return { total, names: names.slice(0, maxNames) };
  }

  private async postSearch(
    apiKey: string,
    body: Record<string, unknown>,
  ): Promise<PdlSearchResponse> {
    const response = await fetch(PDL_PERSON_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as PdlSearchResponse;

    if (!response.ok) {
      this.logger.warn(
        `PDL person search HTTP ${response.status}: ${JSON.stringify(json)}`,
      );
    }

    return json;
  }
}
