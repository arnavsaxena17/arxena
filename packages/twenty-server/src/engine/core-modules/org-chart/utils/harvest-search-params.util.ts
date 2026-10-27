export type HarvestSearchKind = 'leads' | 'accounts';

export const HARVEST_SEARCH_PATHS: Record<HarvestSearchKind, string> = {
  leads: '/linkedin/lead-search',
  accounts: '/linkedin/account-search',
};

// Both searches return 25 rows a page and stop at page 100
export const HARVEST_SEARCH_PAGE_SIZE = 25;
export const HARVEST_SEARCH_MAX_PAGE = 100;
// One call may fetch at most this many records (10 pages, about $1)
export const HARVEST_SEARCH_MAX_RECORDS_PER_CALL = 250;
export const HARVEST_COST_PER_RECORD_USD = 0.004;

// Query parameters Harvest documents for each search. Anything else is
// dropped and reported, so a Unipile-shaped payload fails loudly.
const HARVEST_SEARCH_PARAMETERS: Record<HarvestSearchKind, ReadonlySet<string>> =
  {
    leads: new Set([
      'search',
      'currentCompanies',
      'pastCompanies',
      'locations',
      'geoIds',
      'schools',
      'currentJobTitles',
      'pastJobTitles',
      'firstNames',
      'lastNames',
      'industryIds',
      'yearsAtCurrentCompanyIds',
      'yearsOfExperienceIds',
      'seniorityLevelIds',
      'functionIds',
      'recentlyChangedJobs',
      'postedOnLinkedin',
      'profileLanguages',
      'companyHeadcount',
      'companyHeadquarterLocations',
      'excludeLocations',
      'excludeGeoIds',
      'excludeCurrentCompanies',
      'excludePastCompanies',
      'excludeSchools',
      'excludeCurrentJobTitles',
      'excludePastJobTitles',
      'excludeIndustryIds',
      'excludeSeniorityLevelIds',
      'excludeFunctionIds',
      'excludeCompanyHeadquarterLocations',
      'salesNavUrl',
    ]),
    accounts: new Set([
      'search',
      'headquarterLocations',
      'headquarterGeoIds',
      'industryIds',
      'companyHeadcount',
      'companyHeadcountGrowth',
      'annualRevenue',
      'numOfFollowers',
      'departmentHeadcount',
      'departmentHeadcountGrowth',
      'jobOpportunities',
      'accountActivities',
      'fortune',
      'excludeHeadquarterLocations',
      'excludeHeadquarterGeoIds',
      'excludeIndustryIds',
      'excludeCompanyHeadcount',
    ]),
  };

const toQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'boolean') {
    return value ? 'true' : undefined;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }

  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  // Harvest takes lists as comma-separated strings
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => toQueryValue(item))
      .filter((item): item is string => item !== undefined)
      .join(',');

    return joined || undefined;
  }

  return undefined;
};

export const buildHarvestSearchQuery = (
  kind: HarvestSearchKind,
  searchParameters: Record<string, unknown> | undefined,
): { query: Record<string, string>; ignored: string[] } => {
  const allowed = HARVEST_SEARCH_PARAMETERS[kind];
  const query: Record<string, string> = {};
  const ignored: string[] = [];

  for (const [key, value] of Object.entries(searchParameters ?? {})) {
    if (!allowed.has(key)) {
      ignored.push(key);
      continue;
    }

    const queryValue = toQueryValue(value);
    if (queryValue !== undefined) {
      query[key] = queryValue;
    }
  }

  return { query, ignored };
};

const stripWrapping = (term: string): string =>
  term
    .trim()
    .replace(/^\(+|\)+$/g, '')
    .replace(/^"|"$/g, '')
    .trim();

// A generated title expression is either a plain OR list, which Harvest takes
// as `currentJobTitles`, or a factored boolean (AND, NOT, nesting), which only
// the `search` field understands. Returns null for the latter.
export const splitHarvestTitleList = (expression: string): string[] | null => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return [];
  }

  const inner = trimmed.replace(/^\((.*)\)$/s, '$1');
  if (/\b(AND|NOT)\b|[()]/.test(inner)) {
    return null;
  }

  const titles = inner
    .split(/\s+OR\s+/)
    .map(stripWrapping)
    .filter(Boolean);

  return titles.length > 0 ? [...new Set(titles)] : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pickFields = (
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> =>
  Object.fromEntries(
    keys
      .filter((key) => record[key] !== undefined && record[key] !== null)
      .map((key) => [key, record[key]]),
  );

// A full page of accounts (descriptions, logos, highlight messages) can pass
// the tool result size cap, and a truncated page cannot become list rows, so
// only the fields the list and the agent use go back
export const compactHarvestSearchItem = (
  kind: HarvestSearchKind,
  item: Record<string, unknown>,
): Record<string, unknown> => {
  if (kind === 'accounts') {
    const description =
      typeof item.description === 'string'
        ? item.description.slice(0, 500)
        : undefined;
    const highlights = Array.isArray(item.highlights)
      ? item.highlights
          .filter(isRecord)
          .map((highlight) => highlight.label)
          .filter((label): label is string => typeof label === 'string')
      : [];

    return {
      ...pickFields(item, [
        'id',
        'name',
        'linkedinUrl',
        'website',
        'industry',
        'employeeCountRange',
        'employeeDisplayCount',
        'location',
      ]),
      ...(description ? { description } : {}),
      ...(highlights.length > 0 ? { highlights } : {}),
    };
  }

  const positions = Array.isArray(item.currentPositions)
    ? item.currentPositions
        .filter(isRecord)
        .slice(0, 2)
        .map((position) =>
          pickFields(position, [
            'title',
            'companyName',
            'companyId',
            'companyLinkedinUrl',
          ]),
        )
    : [];
  const location = isRecord(item.location)
    ? item.location.linkedinText
    : item.location;

  return {
    ...pickFields(item, [
      'id',
      'linkedinUrl',
      'firstName',
      'lastName',
      'headline',
      'openProfile',
      'premium',
    ]),
    ...(typeof location === 'string' && location ? { location } : {}),
    ...(positions.length > 0 ? { currentPositions: positions } : {}),
  };
};

export const getHarvestNextPage = (
  pageNumber: number,
  totalPages: number | undefined,
  lastPageSize: number,
): number | null => {
  const nextPage = pageNumber + 1;

  if (lastPageSize === 0 || nextPage > HARVEST_SEARCH_MAX_PAGE) {
    return null;
  }

  if (typeof totalPages === 'number' && nextPage > totalPages) {
    return null;
  }

  return nextPage;
};
