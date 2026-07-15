import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type UnipileCompanyProfileDto = {
  id?: string;
  entity_urn?: string;
  public_identifier?: string;
  employee_count?: number;
  description?: string;
  tagline?: string;
  logo?: string;
  logo_large?: string;
  website?: string;
  name?: string;
  profile_url?: string;
  locations?: Array<{
    city?: string;
    country?: string;
    area?: string;
    is_headquarter?: boolean;
  }>;
  industry?: string[];
  activities?: string[];
  followers_count?: number;
};

type UnipileCompanyProfileRaw = {
  object?: string;
  id?: string | number;
  entity_urn?: string;
  public_identifier?: string;
  name?: string;
  description?: string;
  tagline?: string;
  logo?: string;
  logo_large?: string;
  website?: string;
  profile_url?: string;
  employee_count?: number;
  followers_count?: number;
  locations?: Array<{
    city?: string;
    country?: string;
    area?: string;
    is_headquarter?: boolean;
  }>;
  industry?: string[];
  activities?: string[];
};

export const extractLinkedinCompanyIdFromUnipileProfile = (
  profile: Pick<UnipileCompanyProfileDto, 'id' | 'entity_urn'>,
): string | null => {
  if (typeof profile.id === 'string' && /^\d+$/.test(profile.id.trim())) {
    return profile.id.trim();
  }

  const urn = profile.entity_urn?.trim();
  if (!urn) {
    return null;
  }

  const match = urn.match(/fsd_company:(\d+)/i) ?? urn.match(/:(\d+)\s*$/);
  return match?.[1] ?? null;
};

function extractPublicIdentifier(linkedinUrlOrSlug: string): string | null {
  const trimmed = linkedinUrlOrSlug.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /linkedin\.com\/company\/([^/?]+)/i,
  );
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return trimmed;
}

@Injectable()
export class UnipileCompanyService {
  private readonly logger = new Logger(UnipileCompanyService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  isConfigured(): boolean {
    const url = process.env.UNIPILE_API_URL;
    const token = process.env.UNIPILE_ACCESS_TOKEN;
    return typeof url === 'string' && url.length > 0 &&
      typeof token === 'string' && token.length > 0;
  }

  extractPublicIdentifier(linkedinUrlOrSlug: string): string | null {
    return extractPublicIdentifier(linkedinUrlOrSlug);
  }

  async getCompanyProfile(
    publicIdentifier: string,
    accountId: string,
  ): Promise<UnipileCompanyProfileDto | null> {
    if (!publicIdentifier?.trim() || !accountId?.trim()) {
      return null;
    }

    const slug = publicIdentifier.trim();
    const cacheKey = `unipile-company:${slug}:${accountId}`;

    const cached = await this.cacheStorage.get<UnipileCompanyProfileDto>(cacheKey);
    if (cached) {
      this.logger.log(`Unipile company profile cached for ${slug}`);
      return cached;
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        'UNIPILE_API_URL or UNIPILE_ACCESS_TOKEN not configured, company profile lookup skipped',
      );
      return null;
    }

    const baseUrl = process.env.UNIPILE_API_URL ?? '';
    const apiKey = process.env.UNIPILE_ACCESS_TOKEN ?? '';
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/linkedin/company/${encodeURIComponent(slug)}?account_id=${encodeURIComponent(accountId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-KEY': apiKey,
        },
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const errMsg =
          (data.detail as string) ?? (data.message as string) ?? response.statusText;
        this.logger.warn(
          `Unipile company API error for ${slug}: ${response.status} ${errMsg}`,
        );
        return null;
      }

      const raw = data as UnipileCompanyProfileRaw;
      const rawId =
        typeof raw.id === 'number'
          ? String(raw.id)
          : typeof raw.id === 'string'
            ? raw.id.trim()
            : undefined;
      const profile: UnipileCompanyProfileDto = {
        id: rawId && /^\d+$/.test(rawId) ? rawId : undefined,
        entity_urn:
          typeof raw.entity_urn === 'string' ? raw.entity_urn : undefined,
        public_identifier:
          typeof raw.public_identifier === 'string'
            ? raw.public_identifier
            : undefined,
        employee_count: typeof raw.employee_count === 'number' ? raw.employee_count : undefined,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        tagline: typeof raw.tagline === 'string' ? raw.tagline : undefined,
        logo: typeof raw.logo === 'string' ? raw.logo : undefined,
        logo_large: typeof raw.logo_large === 'string' ? raw.logo_large : undefined,
        website: typeof raw.website === 'string' ? raw.website : undefined,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        profile_url: typeof raw.profile_url === 'string' ? raw.profile_url : undefined,
        followers_count: typeof raw.followers_count === 'number' ? raw.followers_count : undefined,
        locations: Array.isArray(raw.locations) ? raw.locations : undefined,
        industry: Array.isArray(raw.industry) ? raw.industry : undefined,
        activities: Array.isArray(raw.activities) ? raw.activities : undefined,
      };

      await this.cacheStorage.set(cacheKey, profile, CACHE_TTL_MS);
      return profile;
    } catch (error) {
      this.logger.error(`Unipile company profile fetch failed for ${slug}`, error);
      return null;
    }
  }
}
