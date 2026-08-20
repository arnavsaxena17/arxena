import { Injectable } from '@nestjs/common';

import type { CompanySearchHit } from '../company-api.types';

const readString = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

@Injectable()
export class CompanySearchHitTransformer {
  fromUnipileItems(
    items: Array<{ type?: string; object?: string } & Record<string, unknown>>,
  ): CompanySearchHit[] {
    return items
      .filter(
        (item) =>
          item.type === 'COMPANY' ||
          item.object === 'SavedAccount' ||
          (!item.type &&
            (typeof item.name === 'string' ||
              typeof item.display_name === 'string')),
      )
      .map((item) => this.fromUnipileItem(item));
  }

  fromUnipileItem(item: Record<string, unknown>): CompanySearchHit {
    return {
      id: readString(item, ['id']),
      name: readString(item, ['name', 'display_name']),
      website: readString(item, ['website']),
      linkedinUrl: readString(item, ['profile_url', 'linkedinUrl', 'url']),
      industry: readString(item, ['industry']),
    };
  }

  fromHarvestItem(item: Record<string, unknown>): CompanySearchHit {
    return {
      id: readString(item, ['id', 'universalName', 'universal_name']),
      name: readString(item, ['name', 'companyName']),
      website: readString(item, ['website', 'websiteUrl']),
      linkedinUrl: readString(item, [
        'linkedinUrl',
        'linkedin_url',
        'url',
        'profileUrl',
      ]),
      industry: readString(item, ['industry']),
    };
  }

  fromIndexItem(item: {
    id?: string;
    name?: string;
    website?: string;
    linkedin_url?: string;
    industry?: string;
  }): CompanySearchHit {
    return {
      id: item.id ?? '',
      name: item.name ?? '',
      website: item.website ?? '',
      linkedinUrl: item.linkedin_url ?? '',
      industry: item.industry ?? '',
    };
  }
}
