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

/**
 * LinkedIn company facet ids for Unipile people search.
 * Prefer the autocomplete id for the primary company; fall back to slugs for
 * additional URL-pasted companies so multi-company estimates include every source.
 * Prefer numeric profile-resolved ids when available.
 */
export const resolveSuperImposeLinkedinCompanyParameterIds = (
  resolvedCompanies: SuperImposeResolvedCompany[],
  primaryParameterId?: string,
  profileResolvedCompanyIds?: Array<string | null | undefined>,
): string[] => {
  const primaryId = primaryParameterId?.trim();
  if (resolvedCompanies.length === 0) {
    return primaryId ? [primaryId] : [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (let index = 0; index < resolvedCompanies.length; index += 1) {
    const company = resolvedCompanies[index];
    const profileId = profileResolvedCompanyIds?.[index]?.trim();
    const id =
      (profileId && profileId.length > 0 ? profileId : undefined) ??
      (index === 0 && primaryId ? primaryId : undefined) ??
      company.slug.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
};

export type SuperImposeCompanyProfileFacet = {
  slug: string;
  linkedinCompanyId: string | null;
  companyName?: string;
  employeeCount?: number;
  resolvedVia: 'company_profile' | 'primary_parameter' | 'slug_fallback' | 'failed';
  error?: string;
};

export const sumSuperImposeEmployeeCounts = (
  facets: SuperImposeCompanyProfileFacet[],
): number | null => {
  if (facets.length === 0) {
    return null;
  }

  let total = 0;
  for (const facet of facets) {
    if (
      typeof facet.employeeCount !== 'number' ||
      !Number.isFinite(facet.employeeCount) ||
      facet.employeeCount < 0
    ) {
      return null;
    }
    total += Math.round(facet.employeeCount);
  }

  return total;
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
