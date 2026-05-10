import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type HarvestLeadItem = Record<string, unknown>;
type HarvestProfileResponse = Record<string, unknown>;

@Injectable()
export class HarvestLinkedinService {
  private readonly logger = new Logger(HarvestLinkedinService.name);
  private static readonly DEFAULT_BASE_URL = 'https://api.harvest-api.com';

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    return typeof apiKey === 'string' && apiKey.length > 0;
  }

  async fetchCurrentAndPastEmployees(input: {
    linkedinCompanyUrl: string;
    maxProfiles?: number;
    /**
     * When true (client sets `includeOrgIntelligence`, e.g. Org intelligence button), also
     * fetch past-company leads and run `/linkedin/profile` enrichment for each past lead.
     * Default false: current employees only — full `maxProfiles` budget for current.
     */
    includePastEmployees?: boolean;
    onProgress?: (message: string) => void | Promise<void>;
  }): Promise<{ current: HarvestLeadItem[]; pastWithProfiles: HarvestLeadItem[] }> {
    const normalizedCompanyUrl = input.linkedinCompanyUrl.trim();
    const maxProfiles = Math.max(1, Math.min(1000, input.maxProfiles ?? 250));
    const includePastEmployees = input.includePastEmployees === true;
    const maxCurrent = includePastEmployees
      ? Math.max(1, Math.floor(maxProfiles / 2))
      : maxProfiles;

    await input.onProgress?.('Harvest: fetching current employees...');
    const current = await this.fetchLeads({
      companyUrl: normalizedCompanyUrl,
      type: 'current',
      maxProfiles: maxCurrent,
    });

    let past: HarvestLeadItem[] = [];
    if (includePastEmployees) {
      const maxPast = Math.max(1, Math.floor(maxProfiles / 2));
      await input.onProgress?.('Harvest: fetching past employees...');
      past = await this.fetchLeads({
        companyUrl: normalizedCompanyUrl,
        type: 'past',
        maxProfiles: maxPast,
      });
      this.logger.log(
        `Harvest company employee fetch done companyUrl="${normalizedCompanyUrl}" currentLeadRows=${current.length} pastLeadRows=${past.length} (past enriched next)`,
      );
    } else {
      this.logger.log(
        `Harvest company employee fetch done companyUrl="${normalizedCompanyUrl}" currentLeadRows=${current.length} pastLeadRows=0 (past skipped — enable includeOrgIntelligence for past + profile enrichment)`,
      );
    }

    const pastWithProfiles: HarvestLeadItem[] = [];
    for (let index = 0; index < past.length; index += 1) {
      const lead = past[index];
      const linkedinUrl = this.extractLinkedinUrl(lead);
      if (!linkedinUrl) {
        pastWithProfiles.push(lead);
        continue;
      }

      const profile = await this.fetchProfile(linkedinUrl);
      pastWithProfiles.push({
        ...lead,
        ...(profile ? { org_harvest_profile: profile } : {}),
      });

      if (index % 10 === 0) {
        await input.onProgress?.(
          `Harvest: enriched ${Math.min(index + 1, past.length)}/${past.length} past profiles...`,
        );
      }
    }

    this.logger.log(
      `Harvest company employee fetch finished companyUrl="${normalizedCompanyUrl}" current=${current.length} pastWithProfiles=${pastWithProfiles.length}`,
    );

    return { current, pastWithProfiles };
  }

  private async fetchLeads(input: {
    companyUrl: string;
    type: 'current' | 'past';
    maxProfiles: number;
  }): Promise<HarvestLeadItem[]> {
    const out: HarvestLeadItem[] = [];
    const pageSize = 25;
    const maxPages = Math.max(1, Math.ceil(input.maxProfiles / pageSize));

    for (let page = 1; page <= maxPages; page += 1) {
      const query =
        input.type === 'current'
          ? `currentCompanies=${encodeURIComponent(input.companyUrl)}`
          : `pastCompanies=${encodeURIComponent(input.companyUrl)}`;
      const url = `${this.getBaseUrl()}/linkedin/lead-search?${query}&page=${page}`;
      const json = await this.getJson(url);
      const items = this.extractLeadItems(json);
      this.logger.log(
        `Harvest lead-search type=${input.type} page=${page} companyUrl="${input.companyUrl}" parsedRows=${items.length} ${this.describeLeadSearchPayloadForLog(json)}`,
      );
      if (items.length === 0) {
        break;
      }
      out.push(...items);
      if (out.length >= input.maxProfiles) {
        return out.slice(0, input.maxProfiles);
      }
    }

    return out;
  }

  private async fetchProfile(
    linkedinUrl: string,
  ): Promise<HarvestProfileResponse | null> {
    const url = `${this.getBaseUrl()}/linkedin/profile?url=${encodeURIComponent(
      linkedinUrl,
    )}`;
    try {
      const json = await this.getJson(url);
      if (!json || typeof json !== 'object') {
        return null;
      }
      // Harvest /linkedin/profile returns `{ element: Profile, status, error, query }`.
      // Downstream consumers expect a Profile-shaped object, so unwrap `element`
      // when present (and tolerate the rare unwrapped shape used in tests).
      const wrapper = json as Record<string, unknown>;
      const inner = wrapper.element;
      if (inner && typeof inner === 'object') {
        return inner as HarvestProfileResponse;
      }
      return wrapper as HarvestProfileResponse;
    } catch (error) {
      this.logger.warn(
        `Harvest profile fetch failed for ${linkedinUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private extractLeadItems(payload: unknown): HarvestLeadItem[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload.filter(
        (row): row is HarvestLeadItem => !!row && typeof row === 'object',
      );
    }
    const objectPayload = payload as Record<string, unknown>;
    const candidates = [
      objectPayload.elements,
      objectPayload.items,
      objectPayload.results,
      objectPayload.data,
      objectPayload.people,
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value.filter(
          (row): row is HarvestLeadItem => !!row && typeof row === 'object',
        );
      }
    }

    this.logger.warn(
      `Harvest lead-search JSON had no known lead array (elements/items/results/data/people). ${this.describeLeadSearchPayloadForLog(payload)}`,
    );

    return [];
  }

  /** Debug helper: no profile rows, only shapes and Harvest status fields. */
  private describeLeadSearchPayloadForLog(payload: unknown): string {
    if (payload === null) {
      return 'payload=null';
    }
    if (Array.isArray(payload)) {
      return `payload=array length=${payload.length}`;
    }
    if (typeof payload !== 'object') {
      return `payloadType=${typeof payload}`;
    }
    const o = payload as Record<string, unknown>;
    const keys = Object.keys(o).sort().join(',');
    const arrayLen = (k: string): string => {
      const v = o[k];
      return Array.isArray(v) ? String(v.length) : '—';
    };
    const status =
      typeof o.status === 'string' ? o.status : JSON.stringify(o.status);
    const error =
      typeof o.error === 'string' ? o.error : JSON.stringify(o.error);
    return `topLevelKeys=[${keys}] elementsLen=${arrayLen('elements')} itemsLen=${arrayLen('items')} resultsLen=${arrayLen('results')} status=${status} error=${error}`;
  }

  private extractLinkedinUrl(lead: HarvestLeadItem): string | undefined {
    const candidates = [
      lead.linkedinUrl,
      lead.linkedin_url,
      lead.profileUrl,
      lead.profile_url,
      lead.url,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private getApiKey(): string | undefined {
    const envValue = this.environmentService.get('HARVEST_API_KEY');
    return typeof envValue === 'string' && envValue.trim().length > 0
      ? envValue.trim()
      : undefined;
  }

  private getBaseUrl(): string {
    const envValue = this.environmentService.get('HARVEST_API_BASE_URL');
    return typeof envValue === 'string' && envValue.trim().length > 0
      ? envValue.trim().replace(/\/+$/, '')
      : HarvestLinkedinService.DEFAULT_BASE_URL;
  }

  private async getJson(url: string): Promise<unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('HARVEST_API_KEY is not configured');
    }
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Harvest request failed with status ${response.status}`);
    }
    return response.json();
  }
}
