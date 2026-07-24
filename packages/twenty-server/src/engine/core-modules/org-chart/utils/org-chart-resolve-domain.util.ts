const MULTI_PART_TLD_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'com.au',
  'com.br',
  'co.in',
  'co.nz',
  'com.sg',
  'com.mx',
  'co.jp',
  'co.kr',
  'com.tr',
  'com.ar',
]);

/** Strip protocol, path, and www prefix from a website URL or bare domain string. */
export const normalizeBareCompanyDomain = (
  input?: string | null,
): string | undefined => {
  const raw = input?.trim();
  if (!raw) {
    return undefined;
  }

  try {
    const withProtocol = raw.startsWith('http') ? raw : `https://${raw}`;
    const { hostname } = new URL(withProtocol);
    const bare = hostname.replace(/^www\./iu, '').trim().toLowerCase();
    return bare.length > 0 ? bare : undefined;
  } catch {
    const trimmed = raw
      .replace(/^https?:\/\//iu, '')
      .split('/')[0]
      ?.replace(/^www\./iu, '')
      .trim()
      .toLowerCase();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }
};

/** `dashboard.unipile.com` → `unipile.com`; `arxena.com` stays as-is. */
export const extractRootCompanyDomain = (bareDomain: string): string => {
  const bare = bareDomain.replace(/^www\./iu, '').trim().toLowerCase();
  const parts = bare.split('.').filter(Boolean);
  if (parts.length <= 2) {
    return bare;
  }

  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_PART_TLD_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }

  return lastTwo;
};

/** `unipile.com` → `unipile`; `dashboard.unipile.com` → `unipile`. */
export const extractCompanyNameStemFromDomain = (
  bareDomain: string,
): string | undefined => {
  const root = extractRootCompanyDomain(bareDomain);
  const parts = root.split('.').filter(Boolean);
  if (parts.length < 2) {
    return parts[0] || undefined;
  }

  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (MULTI_PART_TLD_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts[parts.length - 3] || undefined;
  }

  return parts[parts.length - 2] || undefined;
};

/** Domains to query in ES, most specific first. */
export const collectDomainLookupCandidates = (bareDomain: string): string[] => {
  const bare = bareDomain.replace(/^www\./iu, '').trim().toLowerCase();
  if (!bare) {
    return [];
  }

  const ordered = [bare, extractRootCompanyDomain(bare)];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const candidate of ordered) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    candidates.push(candidate);
  }

  return candidates;
};

/** Values stored in ES `job_company_website` / `website` keyword fields vary; query all common forms. */
export const buildCompanyWebsiteLookupVariants = (
  bareDomain: string,
): string[] => {
  const bare = bareDomain.replace(/^www\./iu, '').trim().toLowerCase();
  if (!bare) {
    return [];
  }

  const variants = new Set<string>([
    bare,
    `www.${bare}`,
    `https://${bare}`,
    `https://www.${bare}`,
    `http://${bare}`,
    `http://www.${bare}`,
  ]);

  return [...variants];
};

const PLACEHOLDER_ORG_CHART_COMPANY_IDS = new Set([
  'companies',
  'company',
  'unknown',
]);

/** Reject generic placeholder slugs that must never resolve as a real org chart. */
export const isUsableOrgChartResolveCompanyId = (
  companyId?: string | null,
): boolean => {
  const normalized = companyId?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return !PLACEHOLDER_ORG_CHART_COMPANY_IDS.has(normalized);
};

export const isUsableOrgChartEsDocument = (document: {
  job_company_id?: string;
  is_blank_template?: boolean;
}): boolean => {
  if (document.is_blank_template === true) {
    return false;
  }

  return isUsableOrgChartResolveCompanyId(document.job_company_id);
};
