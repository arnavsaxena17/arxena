import { isNonEmptyString } from '@sniptt/guards';

import type { CompanySearchHit } from '../company-api.types';

export type CompanyIdentityRecord = {
  name?: string | null;
  linkedinId?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  domainNamePrimaryLinkUrl?: string | null;
};

export const normalizeCompanyUrl = (value?: string | null): string => {
  if (!isNonEmptyString(value)) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
};

export const extractLinkedinCompanyId = (hit: {
  id?: string | null;
  linkedinUrl?: string | null;
}): string => {
  const id = hit.id?.trim() ?? '';

  if (/^\d+$/.test(id)) {
    return id;
  }

  const fromUrl = (hit.linkedinUrl ?? '').match(
    /linkedin\.com\/(?:company|school|showcase)\/(\d+)/i,
  );

  if (fromUrl?.[1]) {
    return fromUrl[1];
  }

  if (isNonEmptyString(id) && !id.includes('/') && !id.includes('http')) {
    return id;
  }

  return '';
};

export const companyLinkedinUrl = (row: CompanyIdentityRecord): string =>
  row.linkedinLink?.primaryLinkUrl ?? row.linkedinLinkPrimaryLinkUrl ?? '';

export const companyWebsiteUrl = (row: CompanyIdentityRecord): string =>
  row.domainName?.primaryLinkUrl ?? row.domainNamePrimaryLinkUrl ?? '';

export const identityKeysForHit = (hit: CompanySearchHit): string[] =>
  identityKeys({
    id: extractLinkedinCompanyId(hit),
    name: hit.name,
    linkedinUrl: hit.linkedinUrl,
    website: hit.website,
  });

export const identityKeysForRecord = (
  row: CompanyIdentityRecord,
): string[] =>
  identityKeys({
    id: (row.linkedinId ?? '').trim(),
    name: row.name ?? '',
    linkedinUrl: companyLinkedinUrl(row),
    website: companyWebsiteUrl(row),
  });

export const collectIdentityKeySet = (
  rows: CompanyIdentityRecord[],
): Set<string> => {
  const keys = new Set<string>();

  for (const row of rows) {
    for (const key of identityKeysForRecord(row)) {
      keys.add(key);
    }
  }

  return keys;
};

export const hitMatchesIdentityKeys = (
  hit: CompanySearchHit,
  knownKeys: Set<string>,
): boolean => identityKeysForHit(hit).some((key) => knownKeys.has(key));

export const findMatchingCompanyRecord = <T extends CompanyIdentityRecord>(
  hit: CompanySearchHit,
  rows: T[],
): T | undefined => {
  const linkedinId = extractLinkedinCompanyId(hit);

  if (isNonEmptyString(linkedinId)) {
    const byId = rows.find(
      (row) => (row.linkedinId ?? '').trim() === linkedinId,
    );

    if (byId) {
      return byId;
    }
  }

  const hitKeys = identityKeysForHit(hit);

  return rows.find((row) => {
    const existingId = (row.linkedinId ?? '').trim();

    if (
      isNonEmptyString(linkedinId) &&
      isNonEmptyString(existingId) &&
      existingId !== linkedinId
    ) {
      return false;
    }

    return identityKeysForRecord(row).some((key) => hitKeys.includes(key));
  });
};

const identityKeys = (input: {
  id: string;
  name: string;
  linkedinUrl: string;
  website: string;
}): string[] => {
  const keys: string[] = [];
  const linkedin = normalizeCompanyUrl(input.linkedinUrl);
  const website = normalizeCompanyUrl(input.website);
  const name = input.name.trim().toLowerCase();

  if (isNonEmptyString(input.id)) {
    keys.push(`id:${input.id}`);
  }

  if (linkedin) {
    keys.push(`li:${linkedin}`);
  }

  if (website) {
    keys.push(`web:${website}`);
  }

  if (name) {
    keys.push(`name:${name}`);
  }

  return keys;
};
