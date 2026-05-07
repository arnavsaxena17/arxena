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
    onProgress?: (message: string) => void | Promise<void>;
  }): Promise<{ current: HarvestLeadItem[]; pastWithProfiles: HarvestLeadItem[] }> {
    const normalizedCompanyUrl = input.linkedinCompanyUrl.trim();
    const maxProfiles = Math.max(1, Math.min(1000, input.maxProfiles ?? 250));
    const maxPerBucket = Math.max(1, Math.floor(maxProfiles / 2));

    await input.onProgress?.('Harvest: fetching current employees...');
    const current = await this.fetchLeads({
      companyUrl: normalizedCompanyUrl,
      type: 'current',
      maxProfiles: maxPerBucket,
    });

    await input.onProgress?.('Harvest: fetching past employees...');
    const past = await this.fetchLeads({
      companyUrl: normalizedCompanyUrl,
      type: 'past',
      maxProfiles: maxPerBucket,
    });

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
      return json && typeof json === 'object' ? (json as HarvestProfileResponse) : null;
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

    return [];
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
