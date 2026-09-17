export type LinkedInSearchUrlCategory = 'people' | 'companies';

export type LinkedInSearchUrlProduct =
  | 'classic'
  | 'sales_navigator'
  | 'recruiter';

export type ClassifiedLinkedInSearchUrl = {
  url: string;
  category: LinkedInSearchUrlCategory;
  product: LinkedInSearchUrlProduct;
};

const LINKEDIN_HOST_RE = /(^|\.)linkedin\.com$/i;

export const classifyLinkedInSearchUrl = (
  raw: string,
): ClassifiedLinkedInSearchUrl | null => {
  const parsed = parseLinkedInUrl(raw);
  if (!parsed) {
    return null;
  }

  const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '');

  if (pathname.includes('/sales/search/people')) {
    return {
      url: parsed.toString(),
      category: 'people',
      product: 'sales_navigator',
    };
  }

  // Saved Sales Navigator lead lists — Unipile accepts these as people URL search
  if (pathname.includes('/sales/lists/people')) {
    return {
      url: parsed.toString(),
      category: 'people',
      product: 'sales_navigator',
    };
  }

  if (
    pathname.includes('/sales/search/company') ||
    pathname.includes('/sales/search/companies')
  ) {
    return {
      url: parsed.toString(),
      category: 'companies',
      product: 'sales_navigator',
    };
  }

  if (pathname.includes('/search/results/people')) {
    return {
      url: parsed.toString(),
      category: 'people',
      product: 'classic',
    };
  }

  if (pathname.includes('/search/results/companies')) {
    return {
      url: parsed.toString(),
      category: 'companies',
      product: 'classic',
    };
  }

  if (
    pathname.includes('/talent/search') ||
    pathname.includes('/talent/hire/')
  ) {
    return {
      url: parsed.toString(),
      category: 'people',
      product: 'recruiter',
    };
  }

  return null;
};

export const isPeopleLinkedInSearchUrl = (
  classified: ClassifiedLinkedInSearchUrl | null,
): boolean => classified?.category === 'people';

export const isCompanyLinkedInSearchUrl = (
  classified: ClassifiedLinkedInSearchUrl | null,
): boolean => classified?.category === 'companies';

export const isHarvestSalesNavigatorPeopleSearchUrl = (
  classified: ClassifiedLinkedInSearchUrl | null,
): boolean => {
  if (
    classified?.category !== 'people' ||
    classified.product !== 'sales_navigator'
  ) {
    return false;
  }

  // Harvest only supports Sales Nav people search, not saved lead lists
  try {
    const pathname = new URL(classified.url).pathname.toLowerCase();

    return pathname.includes('/sales/search/people');
  } catch {
    return false;
  }
};

export const extractSalesNavigatorAccountListId = (
  raw: string,
): string | null => {
  const parsed = parseLinkedInUrl(raw);
  if (!parsed) {
    return null;
  }

  const pathname = parsed.pathname.toLowerCase();

  // People lead lists share /sales/lists but are not account lists
  if (pathname.includes('/sales/lists/people')) {
    return null;
  }

  const rawId =
    parsed.searchParams.get('listId') ?? parsed.searchParams.get('list_id');
  if (!rawId?.trim()) {
    return null;
  }

  const id = rawId.trim().replace(/^ACCOUNT_/i, '');
  if (!/^(\d+|ALL)$/.test(id)) {
    return null;
  }

  const listGroup = (parsed.searchParams.get('listGroup') ?? '').toUpperCase();
  const isAccountListPath =
    pathname.includes('/sales/accounts') || pathname.includes('/sales/lists');
  if (!isAccountListPath && listGroup !== 'CUSTOM_LISTS') {
    return null;
  }

  return id;
};

const parseLinkedInUrl = (raw: string): URL | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, '')}`;
    const parsed = new URL(withProtocol);
    if (!LINKEDIN_HOST_RE.test(parsed.hostname)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};
