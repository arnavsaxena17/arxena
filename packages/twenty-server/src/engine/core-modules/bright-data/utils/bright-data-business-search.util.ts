import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import type { OutreachEphemeralCompany } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import type { OutreachEphemeralPerson } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';

export type BrightDataBusinessSearchEntity = 'company' | 'people';

export type BrightDataBusinessSearchMode = 'smart' | 'instant' | 'ludicrous';

export type BrightDataBusinessSearchView = 'full' | 'summary' | 'id_only';

export type BrightDataBusinessSearchDocument = {
  brightId: string;
  data: Record<string, unknown>;
};

export const BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH = 200;

export const BRIGHT_DATA_BUSINESS_SEARCH_PAGE_SIZE: Record<
  BrightDataBusinessSearchMode,
  number
> = {
  smart: 10,
  instant: 100,
  ludicrous: 100,
};

export const BRIGHT_DATA_BUSINESS_SEARCH_MAX_RESULTS: Record<
  BrightDataBusinessSearchMode,
  number
> = {
  smart: 100,
  instant: 1000,
  // offset is capped at 1000 and limit at 100, so a single query tops out here
  ludicrous: 1100,
};

export const normalizeBrightDataBusinessSearchMode = (
  mode?: string,
): BrightDataBusinessSearchMode => {
  const normalized = mode?.trim().toLowerCase();

  if (!normalized || normalized === 'ludicrous') {
    return 'ludicrous';
  }

  if (normalized === 'smart' || normalized === 'instant') {
    return normalized;
  }

  throw new Error(
    'Bright Data business search mode must be ludicrous, smart or instant',
  );
};

export const planBrightDataBusinessSearchPages = ({
  mode,
  limit,
  offset,
}: {
  mode: BrightDataBusinessSearchMode;
  limit?: number;
  offset?: number;
}): Array<{ offset: number; limit: number }> => {
  const pageSize = BRIGHT_DATA_BUSINESS_SEARCH_PAGE_SIZE[mode];
  const maxResults = BRIGHT_DATA_BUSINESS_SEARCH_MAX_RESULTS[mode];
  const requested = Math.min(
    Math.max(1, limit ?? pageSize),
    // offset must stay <= 1000 for ludicrous, so the last page starts there
    mode === 'ludicrous'
      ? Math.max(1, maxResults - Math.max(0, offset ?? 0))
      : maxResults,
  );
  const pages: Array<{ offset: number; limit: number }> = [];
  let collected = 0;
  let nextOffset = Math.max(0, offset ?? 0);

  while (collected < requested) {
    const pageLimit = Math.min(pageSize, requested - collected);

    pages.push({ offset: nextOffset, limit: pageLimit });
    collected += pageLimit;
    nextOffset += pageLimit;
  }

  return pages;
};

const readString = (
  record: Record<string, unknown>,
  key: string,
): string => {
  const value = record[key];

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
};

const websiteHost = (website: string): string => {
  if (!website) {
    return '';
  }

  try {
    const withProtocol = /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;

    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return website
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
};

export const mapBrightDataCompanyToSearchHit = (
  document: BrightDataBusinessSearchDocument,
): CompanySearchHit => {
  const data = document.data;
  const website = readString(data, 'website') || readString(data, 'domain');
  const employees = readString(data, 'employees_in_linkedin');
  const sizeFrom = readString(data, 'company_size_from');
  const sizeTo = readString(data, 'company_size_to');

  return {
    id: document.brightId,
    name: readString(data, 'name'),
    website,
    linkedinUrl: readString(data, 'url'),
    industry: readString(data, 'industry'),
    country: readString(data, 'headquarters_country_code') || undefined,
    locality: readString(data, 'headquarters_city') || undefined,
    size:
      employees ||
      (sizeFrom && sizeTo ? `${sizeFrom}-${sizeTo}` : sizeFrom || sizeTo) ||
      undefined,
    founded: readString(data, 'founded_year') || undefined,
  };
};

export const mapBrightDataCompanyToEphemeral = (
  document: BrightDataBusinessSearchDocument,
): OutreachEphemeralCompany | null => {
  const hit = mapBrightDataCompanyToSearchHit(document);

  if (!hit.name) {
    return null;
  }

  return {
    id: hit.id,
    name: hit.name,
    domain: websiteHost(hit.website),
    industry: hit.industry,
    employees: hit.size ?? '',
    segment: readString(document.data, 'organization_type'),
    icpFit: '',
    status: 'new',
  };
};

export const mapBrightDataPersonToSearchItem = (
  document: BrightDataBusinessSearchDocument,
): Record<string, unknown> => {
  const data = document.data;
  const title = readString(data, 'current_title');
  const location =
    readString(data, 'location') || readString(data, 'city');

  return {
    name: readString(data, 'name'),
    first_name: readString(data, 'first_name'),
    title,
    headline: title,
    about: readString(data, 'about'),
    companyName: readString(data, 'current_company_name'),
    url: readString(data, 'url'),
    location,
    source: 'bright_data',
    brightId: document.brightId,
  };
};

export const mapBrightDataPersonToEphemeral = (
  document: BrightDataBusinessSearchDocument,
): OutreachEphemeralPerson | null => {
  const item = mapBrightDataPersonToSearchItem(document);
  const name = typeof item.name === 'string' ? item.name : '';

  if (!name) {
    return null;
  }

  return {
    id: document.brightId,
    name,
    title: typeof item.title === 'string' ? item.title : '',
    headline: typeof item.headline === 'string' ? item.headline : '',
    summary: typeof item.about === 'string' ? item.about : '',
    companyId: '',
    companyName:
      typeof item.companyName === 'string' ? item.companyName : '',
    linkedinUrl: typeof item.url === 'string' ? item.url : '',
    warmPath: '—',
    stage: 'queued',
    email: '',
  };
};
