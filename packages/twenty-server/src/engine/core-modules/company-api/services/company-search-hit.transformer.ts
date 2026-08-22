import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isPlainObject } from 'twenty-shared/utils';

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

const readUrl = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (
      isPlainObject(value) &&
      typeof value.primaryLinkUrl === 'string' &&
      value.primaryLinkUrl.trim()
    ) {
      return value.primaryLinkUrl.trim();
    }
  }

  return '';
};

const readWebsites = (item: Record<string, unknown>): string => {
  const websites = item.websites;

  if (!Array.isArray(websites)) {
    return '';
  }

  for (const website of websites) {
    if (typeof website === 'string' && website.trim()) {
      return website.trim();
    }

    if (
      isPlainObject(website) &&
      typeof website.url === 'string' &&
      website.url.trim()
    ) {
      return website.url.trim();
    }
  }

  return '';
};

const readLinkedinUrl = (item: Record<string, unknown>): string => {
  const fromKeys = readUrl(item, [
    'linkedinUrl',
    'linkedin_url',
    'profile_url',
    'public_profile_url',
    'profileUrl',
    'linkedinLink',
  ]);

  if (fromKeys) {
    return fromKeys;
  }

  const publicIdentifier = readString(item, [
    'public_identifier',
    'universalName',
    'universal_name',
  ]);

  if (publicIdentifier && !publicIdentifier.includes('/')) {
    return `https://www.linkedin.com/company/${publicIdentifier}`;
  }

  return '';
};

const parseJsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
    return this.fromAnyItem(item);
  }

  fromHarvestItem(item: Record<string, unknown>): CompanySearchHit {
    return this.fromAnyItem(item);
  }

  fromIndexItem(item: {
    id?: string;
    name?: string;
    website?: string;
    linkedin_url?: string;
    industry?: string;
  }): CompanySearchHit {
    return this.fromAnyItem(item);
  }

  fromAnyItem(item: unknown): CompanySearchHit {
    if (typeof item === 'string') {
      const parsed = parseJsonValue(item);

      if (parsed !== item) {
        return this.fromAnyItem(parsed);
      }

      return {
        id: '',
        name: item.trim(),
        website: '',
        linkedinUrl: '',
        industry: '',
      };
    }

    if (!isPlainObject(item)) {
      return { id: '', name: '', website: '', linkedinUrl: '', industry: '' };
    }

    return {
      id: readString(item, ['id', 'universalName', 'universal_name']),
      name: readString(item, ['name', 'display_name', 'companyName']),
      website:
        readUrl(item, ['website', 'websiteUrl', 'domain', 'domainName']) ||
        readWebsites(item),
      linkedinUrl: readLinkedinUrl(item),
      industry: readString(item, ['industry']),
    };
  }

  fromUnknownInput(raw: unknown): CompanySearchHit[] {
    return this.unwrapCompanyRows(raw)
      .map((item) => this.fromAnyItem(item))
      .filter(
        (hit) =>
          isNonEmptyString(hit.name) ||
          isNonEmptyString(hit.website) ||
          isNonEmptyString(hit.linkedinUrl),
      );
  }

  private unwrapCompanyRows(raw: unknown): unknown[] {
    if (typeof raw === 'string') {
      return this.unwrapCompanyRows(parseJsonValue(raw.trim()));
    }

    if (Array.isArray(raw)) {
      if (raw.length === 1 && typeof raw[0] === 'string') {
        const parsed = parseJsonValue(raw[0].trim());

        if (parsed !== raw[0]) {
          return this.unwrapCompanyRows(parsed);
        }
      }

      return raw;
    }

    if (!isPlainObject(raw)) {
      return [];
    }

    if (Array.isArray(raw.companies)) {
      return raw.companies;
    }

    if (Array.isArray(raw.items)) {
      return raw.items;
    }

    return [raw];
  }
}
