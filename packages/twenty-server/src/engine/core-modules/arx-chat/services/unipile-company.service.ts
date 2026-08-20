import { Injectable, Logger } from '@nestjs/common';

import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';

import { LinkedinProfileCacheService } from './linkedin-profile-cache.service';

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
  public_picture_url?: string;
  public_picture_url_large?: string;
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
    private readonly linkedinProfileCacheService: LinkedinProfileCacheService,
    private readonly unipileV2Client: UnipileV2Client,
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

    const cached =
      await this.linkedinProfileCacheService.getLinkedinCompanyProfile<UnipileCompanyProfileDto>(
        slug,
      );
    if (cached) {
      this.logger.log(`LinkedIn company profile cached for ${slug}`);
      return cached;
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        'UNIPILE_API_URL or UNIPILE_ACCESS_TOKEN not configured, company profile lookup skipped',
      );
      return null;
    }

    try {
      const data = (await this.unipileV2Client.getCompany(accountId, slug)) as Record<string, unknown>;

      const raw = data as UnipileCompanyProfileRaw;
      const rawId =
        typeof raw.id === 'number'
          ? String(raw.id)
          : typeof raw.id === 'string'
            ? raw.id.trim()
            : undefined;
      const logo =
        typeof raw.logo === 'string'
          ? raw.logo
          : typeof raw.public_picture_url === 'string'
            ? raw.public_picture_url
            : undefined;
      const logoLarge =
        typeof raw.logo_large === 'string'
          ? raw.logo_large
          : typeof raw.public_picture_url_large === 'string'
            ? raw.public_picture_url_large
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
        logo,
        logo_large: logoLarge,
        website: typeof raw.website === 'string' ? raw.website : undefined,
        name: typeof raw.name === 'string' ? raw.name : undefined,
        profile_url: typeof raw.profile_url === 'string' ? raw.profile_url : undefined,
        followers_count: typeof raw.followers_count === 'number' ? raw.followers_count : undefined,
        locations: Array.isArray(raw.locations) ? raw.locations : undefined,
        industry: Array.isArray(raw.industry) ? raw.industry : undefined,
        activities: Array.isArray(raw.activities) ? raw.activities : undefined,
      };

      await this.linkedinProfileCacheService.saveLinkedinCompanyProfile(slug, profile);
      return profile;
    } catch (error) {
      this.logger.error(`Unipile company profile fetch failed for ${slug}`, error);
      return null;
    }
  }
}
