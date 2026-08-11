// Normalize a company domain or website URL to host without www.
export const normalizeCompanyDomain = (
  domainOrUrl: string,
): string | null => {
  const trimmed = domainOrUrl.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const hostname = new URL(withScheme).hostname
      .replace(/^www\./, '')
      .replace(/\.$/, '');

    if (hostname.length === 0 || !hostname.includes('.')) {
      return null;
    }

    return hostname;
  } catch {
    const fallback = trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('?')[0]
      .replace(/\.$/, '');

    return fallback.includes('.') ? fallback : null;
  }
};

// Build exact P856 URL variants Wikidata commonly stores.
export const buildOfficialWebsiteUrlVariants = (
  domainOrUrl: string,
): string[] => {
  const domain = normalizeCompanyDomain(domainOrUrl);

  if (!domain) {
    return [];
  }

  const variants: string[] = [];

  for (const scheme of ['https', 'http'] as const) {
    for (const wwwPrefix of ['www.', ''] as const) {
      for (const trailingSlash of ['', '/'] as const) {
        variants.push(`${scheme}://${wwwPrefix}${domain}${trailingSlash}`);
      }
    }
  }

  return variants;
};

export const extractHostFromWebsiteUrl = (
  websiteUrl: string,
): string | null => {
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return normalizeCompanyDomain(websiteUrl);
  }
};

// Brand token used for wbsearchentities fallback (clariant.com → clariant).
export const extractBrandFromDomain = (domain: string): string => {
  const normalized = normalizeCompanyDomain(domain) ?? domain.toLowerCase();
  const withoutPublicSuffix = normalized.split('.')[0] ?? normalized;

  return withoutPublicSuffix.replace(/[^a-z0-9-]/gi, '');
};
