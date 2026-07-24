import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const CONTACTOUT_PEOPLE_SEARCH = 'https://api.contactout.com/v1/people/search';

type ContactOutDetailedExperience = {
  title?: string;
  summary?: string;
  locality?: string;
  company_name?: string;
  start_date_year?: number | null;
  start_date_month?: number | null;
  end_date_year?: number | null;
  end_date_month?: number | null;
  is_current?: boolean;
  linkedin_url?: string;
  domain?: string;
  logo_url?: string;
};

export type ContactOutPeopleSearchProfile = {
  li_vanity?: string;
  full_name?: string;
  title?: string;
  headline?: string;
  location?: string;
  country?: string;
  industry?: string;
  updated_at?: string;
  profile_picture_url?: string;
  job_function?: string;
  seniority?: string;
  experience?: ContactOutDetailedExperience[] | string[];
  education?: unknown[];
};

type ContactOutSearchResponse = {
  status_code?: number;
  metadata?: {
    page?: number;
    page_size?: number;
    total_results?: number;
  };
  profiles?: Record<string, ContactOutPeopleSearchProfile>;
};

export type ContactOutPeopleSearchResult = {
  profiles: Array<{
    linkedinUrl: string;
    profile: ContactOutPeopleSearchProfile;
  }>;
  totalResults: number;
  scanned: number;
};

@Injectable()
export class ContactOutPeopleSearchService {
  private readonly logger = new Logger(ContactOutPeopleSearchService.name);

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
   * Page ContactOut People Search and return profiles.
   * Notes:
   * - ContactOut charges one search credit per profile returned.
   * - People Search is limited to ~60 req/min; throttle defaults to ~1.1s.
   */
  async searchCompanyPeople(input: {
    companyName?: string;
    domain?: string;
    maxScanProfiles?: number;
    throttleMs?: number;
  }): Promise<ContactOutPeopleSearchResult> {
    const token = this.getToken();
    if (!token) {
      throw new Error('CONTACTOUT_API_TOKEN is not configured');
    }

    const maxScanRaw = input.maxScanProfiles ?? 2000;
    const maxScan = Math.min(Math.max(1, Math.floor(maxScanRaw)), 5000);
    const throttleMs = input.throttleMs ?? 1100;

    const baseBody = this.buildSearchBase({
      companyName: input.companyName,
      domain: input.domain,
    });

    const out: Array<{ linkedinUrl: string; profile: ContactOutPeopleSearchProfile }> =
      [];

    let page = 1;
    let totalPages = 1;
    let pageSize = 25;
    let totalResults = 0;

    do {
      const body: Record<string, unknown> = {
        ...baseBody,
        page,
        detailed_experience: true,
        detailed_education: false,
        // Avoid charging reveal credits; we only need experience.
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
      if (typeof meta?.page_size === 'number' && meta.page_size > 0) {
        pageSize = meta.page_size;
      }
      totalResults =
        typeof meta?.total_results === 'number' ? meta.total_results : 0;
      totalPages =
        totalResults > 0 && pageSize > 0 ? Math.ceil(totalResults / pageSize) : page;

      const profiles = json.profiles ?? {};
      for (const [url, profile] of Object.entries(profiles)) {
        const linkedinUrl = typeof url === 'string' ? url.trim() : '';
        if (!linkedinUrl) {
          continue;
        }
        out.push({ linkedinUrl, profile });
        if (out.length >= maxScan) {
          return {
            profiles: out,
            totalResults,
            scanned: out.length,
          };
        }
      }

      if (page >= totalPages || Object.keys(profiles).length === 0) {
        break;
      }

      page += 1;
      if (throttleMs > 0) {
        await new Promise((r) => setTimeout(r, throttleMs));
      }
    } while (out.length < maxScan && page <= totalPages);

    return { profiles: out, totalResults, scanned: out.length };
  }

  private buildSearchBase(input: {
    companyName?: string;
    domain?: string;
  }): Record<string, unknown> {
    const companyName = (input.companyName ?? '').trim();
    const domainRaw = (input.domain ?? '').trim();
    if (companyName) {
      return {
        company: [companyName],
        company_filter: 'both',
      };
    }

    let domain = domainRaw;
    domain = domain.replace(/^https?:\/\//i, '');
    domain = domain.replace(/\/.*$/, '');

    if (!domain) {
      throw new Error('ContactOut people search requires companyName or domain');
    }

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
}

