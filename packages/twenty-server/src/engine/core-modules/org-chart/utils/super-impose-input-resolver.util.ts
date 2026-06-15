import type { SuperImposeResolvedCompany } from 'src/engine/core-modules/org-chart/types/super-impose.types';

const LINKEDIN_COMPANY_URL_PATTERN =
  /^https?:\/\/(www\.)?linkedin\.com\/company\/[^/?#]+/i;

const SALES_NAV_PEOPLE_URL_PATTERN =
  /^https?:\/\/(www\.)?linkedin\.com\/sales\/search\/people/i;

export const extractLinkedinCompanySlugFromUrl = (
  url: string,
): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/linkedin\.com\/company\/([^/?#]+)/i);
  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]).trim().toLowerCase();
};

export const normalizeLinkedinCompanyUrl = (
  urlOrSlug: string,
): string | null => {
  const trimmed = urlOrSlug.trim();
  if (!trimmed) {
    return null;
  }

  const slug = extractLinkedinCompanySlugFromUrl(trimmed) ?? trimmed.replace(/^\/+|\/+$/g, '');
  if (!slug) {
    return null;
  }

  return `https://www.linkedin.com/company/${slug}/`;
};

export const isValidLinkedinCompanyPageUrl = (url: string): boolean => {
  return LINKEDIN_COMPANY_URL_PATTERN.test(url.trim());
};

export const isValidSalesNavigatorPeopleSearchUrl = (url: string): boolean => {
  return SALES_NAV_PEOPLE_URL_PATTERN.test(url.trim());
};

export const dedupeNormalizedLinkedinCompanyUrls = (
  urls: string[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of urls) {
    const normalized = normalizeLinkedinCompanyUrl(raw);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const slugToCompanySearchName = (slug: string): string =>
  slug.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

export const resolveSuperImposeCompanySearchName = (
  company: SuperImposeResolvedCompany,
): string => {
  const fromName = company.companyName?.trim();
  if (fromName) {
    return fromName;
  }

  return slugToCompanySearchName(company.slug);
};

export const resolveSuperImposeCompanySearchNames = (
  companies: SuperImposeResolvedCompany[],
): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const company of companies) {
    const name = resolveSuperImposeCompanySearchName(company);
    const key = name.toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(name);
  }

  return result;
};

export const buildResolvedCompanyFromUrl = (
  linkedinUrl: string,
  resolvedFrom: SuperImposeResolvedCompany['resolvedFrom'],
  companyName?: string,
): SuperImposeResolvedCompany | null => {
  const slug = extractLinkedinCompanySlugFromUrl(linkedinUrl);
  if (!slug) {
    return null;
  }

  return {
    slug,
    linkedinUrl: normalizeLinkedinCompanyUrl(linkedinUrl) ?? linkedinUrl,
    resolvedFrom,
    companyName,
  };
};

export const parseMultilineUrlInput = (raw: string | undefined): string[] => {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};
