import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
    ContactOutCompanyRef,
    OrgMovementWindowId,
    PersonOrgMovementResult,
    PersonOrgMovementWindowResult,
} from './person-org-movement.types';

const CONTACTOUT_PEOPLE_SEARCH = 'https://api.contactout.com/v1/people/search';

const WINDOW_DAYS: Record<OrgMovementWindowId, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const DEFAULT_MAX_NAMES_PER_DIRECTION = 100;
/** Caps how many profiles are fetched (1 search credit per profile returned). */
const DEFAULT_MAX_SCAN_PROFILES = 2000;

type ContactOutDetailedExperience = {
  title?: string;
  company_name?: string;
  domain?: string;
  is_current?: boolean;
  start_date_year?: number | null;
  start_date_month?: number | null;
  end_date_year?: number | null;
  end_date_month?: number | null;
};

type ContactOutProfile = {
  full_name?: string;
  updated_at?: string;
  experience?: ContactOutDetailedExperience[] | string[];
};

type ContactOutSearchResponse = {
  status_code?: number;
  metadata?: {
    page?: number;
    page_size?: number;
    total_results?: number;
  };
  profiles?: Record<string, ContactOutProfile>;
};

type WindowBuckets = {
  joined: Set<string>;
  left: Set<string>;
  experienceChanged: Set<string>;
};

@Injectable()
export class ContactOutPersonOrgMovementService {
  private readonly logger = new Logger(ContactOutPersonOrgMovementService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const token = this.environmentService.get('CONTACTOUT_API_TOKEN');

    return typeof token === 'string' && token.length > 0;
  }

  private getToken(): string | undefined {
    const token = this.environmentService.get('CONTACTOUT_API_TOKEN');

    return typeof token === 'string' && token.length > 0 ? token : undefined;
  }

  /**
   * ContactOut does **not** expose join/leave dates as search filters ([People Search](https://api.contactout.com/#people-search-api),
   * [People Count](https://api.contactout.com/#people-count-api)). Count uses the same filters but cannot segment by experience dates.
   *
   * This implementation paginates People Search with `detailed_experience: true` and classifies each profile locally using
   * `start_date_*` / `end_date_*` / `is_current`. Totals reflect **only scanned profiles** (see `maxScanProfiles`). Sub-month windows
   * compare against month boundaries when only year/month exist.
   *
   * **experienceChanged**: uses profile `updated_at` while the person has a current role at the company — can overlap joins and is
   * not a dedicated “title change” signal.
   */
  async getOrgJoinLeaveMovement(
    company: ContactOutCompanyRef,
    options?: {
      referenceDate?: Date;
      windows?: OrgMovementWindowId[];
      maxNamesPerDirection?: number;
      /** Max profiles to pull from search (credits = one per profile). */
      maxScanProfiles?: number;
      /** Milliseconds between paginated search requests (People Search: 60 req/min). */
      throttleMs?: number;
    },
  ): Promise<PersonOrgMovementResult> {
    const token = this.getToken();

    if (!token) {
      throw new Error('CONTACTOUT_API_TOKEN is not configured');
    }

    const referenceDate = options?.referenceDate ?? new Date();
    const windowIds = options?.windows ?? ['1w', '1m', '3m', '6m', '1y'];
    const maxNames =
      options?.maxNamesPerDirection ?? DEFAULT_MAX_NAMES_PER_DIRECTION;
    const maxScan = options?.maxScanProfiles ?? DEFAULT_MAX_SCAN_PROFILES;
    const throttleMs = options?.throttleMs ?? 1100;

    const profiles = await this.fetchProfilesScan(
      token,
      company,
      maxScan,
      throttleMs,
    );

    const buckets = new Map<OrgMovementWindowId, WindowBuckets>();

    for (const w of windowIds) {
      buckets.set(w, {
        joined: new Set(),
        left: new Set(),
        experienceChanged: new Set(),
      });
    }

    const endDate = new Date(referenceDate);

    endDate.setUTCHours(23, 59, 59, 999);

    for (const [, profile] of profiles) {
      const name = profile.full_name?.trim();

      if (!name) {
        continue;
      }

      for (const windowId of windowIds) {
        const days = WINDOW_DAYS[windowId];
        const start = new Date(referenceDate);

        start.setUTCDate(start.getUTCDate() - days);
        start.setUTCHours(0, 0, 0, 0);

        const b = buckets.get(windowId);

        if (!b) {
          continue;
        }

        if (
          this.isJoinedInWindow(
            profile,
            company,
            start.getTime(),
            endDate.getTime(),
          )
        ) {
          b.joined.add(name);
        }

        if (
          this.isLeftInWindow(
            profile,
            company,
            start.getTime(),
            endDate.getTime(),
          )
        ) {
          b.left.add(name);
        }

        if (
          this.isExperienceChangedInWindow(
            profile,
            company,
            start.getTime(),
            endDate.getTime(),
          )
        ) {
          b.experienceChanged.add(name);
        }
      }
    }

    const windows: PersonOrgMovementWindowResult[] = [];

    for (const windowId of windowIds) {
      const b = buckets.get(windowId);

      if (!b) {
        continue;
      }

      const days = WINDOW_DAYS[windowId];
      const start = new Date(referenceDate);

      start.setUTCDate(start.getUTCDate() - days);
      const startDate = start.toISOString().slice(0, 10);
      const endDateStr = referenceDate.toISOString().slice(0, 10);

      windows.push({
        window: windowId,
        range: { startDate, endDate: endDateStr },
        joined: {
          total: b.joined.size,
          names: Array.from(b.joined).slice(0, maxNames),
        },
        left: {
          total: b.left.size,
          names: Array.from(b.left).slice(0, maxNames),
        },
        experienceChanged: {
          total: b.experienceChanged.size,
          names: Array.from(b.experienceChanged).slice(0, maxNames),
        },
      });
    }

    return { source: 'contactout', windows };
  }

  private async fetchProfilesScan(
    token: string,
    company: ContactOutCompanyRef,
    maxScan: number,
    throttleMs: number,
  ): Promise<Map<string, ContactOutProfile>> {
    const out = new Map<string, ContactOutProfile>();
    let page = 1;
    let totalPages = 1;
    let pageSize = 25;

    const baseBody = this.buildSearchBase(company);

    do {
      const body: Record<string, unknown> = {
        ...baseBody,
        page,
        detailed_experience: true,
        reveal_info: false,
      };

      const json = await this.postSearch(token, body);

      if (json.status_code !== 200) {
        this.logger.warn(
          `ContactOut people search non-200: ${JSON.stringify(json)}`,
        );
        break;
      }

      const meta = json.metadata;

      if (meta?.page_size) {
        pageSize = meta.page_size;
      }

      const total =
        typeof meta?.total_results === 'number' ? meta.total_results : 0;

      totalPages =
        total > 0 && pageSize > 0 ? Math.ceil(total / pageSize) : page;

      const profiles = json.profiles ?? {};

      for (const [url, prof] of Object.entries(profiles)) {
        out.set(url, prof);
        if (out.size >= maxScan) {
          return out;
        }
      }

      if (page >= totalPages || Object.keys(profiles).length === 0) {
        break;
      }

      page += 1;
      if (throttleMs > 0) {
        await new Promise((r) => setTimeout(r, throttleMs));
      }
    } while (out.size < maxScan && page <= totalPages);

    return out;
  }

  private buildSearchBase(
    company: ContactOutCompanyRef,
  ): Record<string, unknown> {
    if ('companyName' in company && typeof company.companyName === 'string') {
      return {
        company: [company.companyName.trim()],
        company_filter: 'both',
      };
    }

    let domain = company.domain.trim();

    domain = domain.replace(/^https?:\/\//i, '');

    return {
      domain: [domain],
      company_filter: 'both',
    };
  }

  private async postSearch(
    token: string,
    body: Record<string, unknown>,
  ): Promise<ContactOutSearchResponse> {
    const response = await fetch(CONTACTOUT_PEOPLE_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        token,
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as ContactOutSearchResponse;

    if (!response.ok) {
      this.logger.warn(
        `ContactOut people search HTTP ${response.status}: ${JSON.stringify(json)}`,
      );
    }

    return json;
  }

  private isJoinedInWindow(
    profile: ContactOutProfile,
    company: ContactOutCompanyRef,
    windowStartMs: number,
    windowEndMs: number,
  ): boolean {
    const rows = this.getDetailedExperience(profile);

    for (const row of rows) {
      if (!this.companyMatchesExperience(row, company)) {
        continue;
      }
      if (!row.is_current) {
        continue;
      }

      const startMs = this.experienceStartMs(row);

      if (startMs == null) {
        continue;
      }

      if (startMs >= windowStartMs && startMs <= windowEndMs) {
        return true;
      }
    }

    return false;
  }

  private isLeftInWindow(
    profile: ContactOutProfile,
    company: ContactOutCompanyRef,
    windowStartMs: number,
    windowEndMs: number,
  ): boolean {
    const rows = this.getDetailedExperience(profile);

    for (const row of rows) {
      if (!this.companyMatchesExperience(row, company)) {
        continue;
      }
      if (row.is_current) {
        continue;
      }

      const endMs = this.experienceEndMs(row);

      if (endMs == null) {
        continue;
      }

      if (endMs >= windowStartMs && endMs <= windowEndMs) {
        return true;
      }
    }

    return false;
  }

  private isExperienceChangedInWindow(
    profile: ContactOutProfile,
    company: ContactOutCompanyRef,
    windowStartMs: number,
    windowEndMs: number,
  ): boolean {
    const rows = this.getDetailedExperience(profile);
    let hasCurrentAtCompany = false;

    for (const row of rows) {
      if (!this.companyMatchesExperience(row, company)) {
        continue;
      }
      if (row.is_current) {
        hasCurrentAtCompany = true;
        break;
      }
    }

    if (!hasCurrentAtCompany) {
      return false;
    }

    const updatedMs = this.parseUpdatedAt(profile.updated_at);

    if (updatedMs == null) {
      return false;
    }

    return updatedMs >= windowStartMs && updatedMs <= windowEndMs;
  }

  private getDetailedExperience(
    profile: ContactOutProfile,
  ): ContactOutDetailedExperience[] {
    const ex = profile.experience;

    if (!Array.isArray(ex) || ex.length === 0) {
      return [];
    }

    if (typeof ex[0] === 'string') {
      return [];
    }

    return ex as ContactOutDetailedExperience[];
  }

  private companyMatchesExperience(
    row: ContactOutDetailedExperience,
    company: ContactOutCompanyRef,
  ): boolean {
    if ('companyName' in company && typeof company.companyName === 'string') {
      const a = normalizeCompanyLabel(company.companyName);
      const b = normalizeCompanyLabel(row.company_name ?? '');

      return a.length > 0 && b.length > 0 && a === b;
    }

    const wantDomain = normalizeDomain(company.domain);
    const rowDomain = normalizeDomain(row.domain ?? '');

    return (
      wantDomain.length > 0 && rowDomain.length > 0 && wantDomain === rowDomain
    );
  }

  private experienceStartMs(row: ContactOutDetailedExperience): number | null {
    const y = row.start_date_year;

    if (y == null || y === undefined) {
      return null;
    }

    const m = row.start_date_month;

    const monthIndex = m != null && m >= 1 && m <= 12 ? m - 1 : 0;

    return Date.UTC(y, monthIndex, 1);
  }

  private experienceEndMs(row: ContactOutDetailedExperience): number | null {
    const y = row.end_date_year;

    if (y == null || y === undefined) {
      return null;
    }

    const m = row.end_date_month;

    if (m != null && m >= 1 && m <= 12) {
      return Date.UTC(y, m, 0) + 24 * 60 * 60 * 1000 - 1;
    }

    return Date.UTC(y + 1, 0, 0) + 24 * 60 * 60 * 1000 - 1;
  }

  private parseUpdatedAt(raw: string | undefined): number | null {
    if (!raw?.trim()) {
      return null;
    }

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');

    const ms = Date.parse(normalized);

    return Number.isFinite(ms) ? ms : null;
  }
}

function normalizeCompanyLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeDomain(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
}
