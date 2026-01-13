import type {
  LinkedInClassicPeopleSearchRequest,
  LinkedInSalesNavigatorPeopleSearchRequest,
} from '../../linkedin-search/types/linkedin-search-request.type';

/**
 * Resolved search parameters for URL generation
 * Only accepts numeric IDs (resolved parameters), not names
 */
type ResolvedClassicPeopleSearchParams = Omit<
  LinkedInClassicPeopleSearchRequest,
  'api' | 'category'
> & {
  // Location must be numeric IDs (resolved)
  location?: string[]; // Array of numeric location IDs
  // Company must be numeric IDs (resolved)
  company?: string[]; // Array of numeric company IDs
  past_company?: string[]; // Array of numeric company IDs
  // Optional display info for Sales Navigator
  location_display?: Array<{ id: string; title: string }>;
  company_display?: Array<{ id: string; title: string }>;
};

type ResolvedSalesNavigatorPeopleSearchParams = Omit<
  LinkedInSalesNavigatorPeopleSearchRequest,
  'api' | 'category'
> & {
  // Optional display info for URL generation
  location_display?: Array<{ id: string; title: string }>;
  company_display?: Array<{ id: string; title: string }>;
};

/**
 * Constructs the search parameter key from search type and category
 * @param searchType - The search type (classic, sales_navigator, recruiter)
 * @param searchCategory - The search category (people, companies, posts, jobs)
 * @returns The constructed parameter key (e.g., 'classicPeopleSearch')
 */
export function constructSearchParamKey(
  searchType: string,
  searchCategory: string,
): string {
  const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) =>
    letter.toUpperCase(),
  );
  const capitalizedCategory =
    searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
  return `${camelCaseSearchType}${capitalizedCategory}Search`;
}

/**
 * Checks if a string is a resolved LinkedIn ID (numeric or URN)
 */
function isResolvedId(id: string): boolean {
  return id.match(/^\d+$/) !== null || id.includes('urn:li:');
}

/**
 * Generates a LinkedIn search URL from resolved search parameters
 * @param params - The resolved search parameters (must contain numeric IDs, not names)
 * @param searchType - The search type (classic, sales_navigator, recruiter)
 * @param searchCategory - The search category (people, companies, posts, jobs)
 * @returns The LinkedIn search URL or null if parameters are invalid
 */
export function generateLinkedInSearchUrl(
  params:
    | ResolvedClassicPeopleSearchParams
    | ResolvedSalesNavigatorPeopleSearchParams
    | Record<string, unknown> // Allow other types for flexibility, but only classic/sales_navigator are processed
    | null
    | undefined,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
): string | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  // Handle Sales Navigator format
  if (searchType === 'sales_navigator' && searchCategory === 'people') {
    return generateSalesNavigatorUrl(
      params as ResolvedSalesNavigatorPeopleSearchParams,
    );
  }

  // Handle Classic LinkedIn format
  if (searchType === 'classic' && searchCategory === 'people') {
    return generateClassicLinkedInUrl(
      params as ResolvedClassicPeopleSearchParams,
    );
  }

  return null;
}

/**
 * Generates a Classic LinkedIn search URL from resolved parameters
 * Only accepts numeric IDs for location and company (resolved parameters)
 */
function generateClassicLinkedInUrl(
  params: ResolvedClassicPeopleSearchParams,
): string | null {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const queryParams: string[] = [];

  // Add keywords if present
  if (
    params.keywords &&
    typeof params.keywords === 'string' &&
    params.keywords.trim()
  ) {
    queryParams.push(`keywords=${encodeURIComponent(params.keywords.trim())}`);
  }

  // Add location (geoUrn) if present - only use resolved numeric IDs
  let locationIds: string[] = [];
  if (params.location && Array.isArray(params.location)) {
    locationIds = params.location.filter((id) => {
      // Only include resolved IDs (numeric or URN)
      return typeof id === 'string' && id.trim() && isResolvedId(id);
    });
  }

  if (locationIds.length > 0) {
    const locationArray = JSON.stringify(locationIds);
    queryParams.push(`geoUrn=${encodeURIComponent(locationArray)}`);
  }

  // Add company (currentCompany) if present - only use resolved numeric IDs
  let companyIds: string[] = [];
  if (params.company && Array.isArray(params.company)) {
    companyIds = params.company.filter((id) => {
      // Only include resolved IDs (numeric or URN)
      return typeof id === 'string' && id.trim() && isResolvedId(id);
    });
  }

  if (companyIds.length > 0) {
    const companyArray = JSON.stringify(companyIds);
    queryParams.push(`currentCompany=${encodeURIComponent(companyArray)}`);
  }

  if (queryParams.length === 0) {
    return null;
  }

  queryParams.push('origin=FACETED_SEARCH');
  return `${baseUrl}?${queryParams.join('&')}`;
}

/**
 * Generates a Sales Navigator search URL from resolved parameters
 * Format: https://www.linkedin.com/sales/search/people?query=(...)
 * 
 * Query structure:
 * (spellCorrectionEnabled:true,filters:List((type:CURRENT_COMPANY,values:List((id:urn:li:organization:1406,text:Novartis,selectionType:INCLUDED,parent:(id:0)))),(type:REGION,values:List((id:106164952,text:Mumbai, Maharashtra, India,selectionType:INCLUDED)))),keywords:("sales manager" OR "area sales manager"))
 * 
 * Only accepts resolved numeric IDs for location and company
 */
function generateSalesNavigatorUrl(
  params: ResolvedSalesNavigatorPeopleSearchParams,
): string | null {
  const baseUrl = 'https://www.linkedin.com/sales/search/people';
  const queryParts: string[] = [];

  // Build filters list
  const filters: string[] = [];

  // Add company filter (CURRENT_COMPANY) - only use resolved numeric IDs
  let companyIds: string[] = [];
  const companyDisplay: Array<{ id: string; title: string }> =
    params.company_display || [];

  if (params.company) {
    // Sales Navigator uses include/exclude structure
    if (params.company.include && Array.isArray(params.company.include)) {
      companyIds = params.company.include.filter((id) => {
        // Only include resolved IDs (numeric or URN)
        return typeof id === 'string' && id.trim() && isResolvedId(id);
      });
    }
  }

  // Convert company IDs to URN format (urn:li:organization:ID)
  if (companyIds.length > 0) {
    const companyValues = companyIds.map((id: string) => {
      // Convert numeric ID to URN format
      const urnId = id.startsWith('urn:li:organization:')
        ? id
        : `urn:li:organization:${id}`;
      // Try to find display name
      const displayInfo = companyDisplay.find((d) => d.id === id);
      const text = displayInfo?.title || 'Unknown';
      // Escape commas and special characters in text
      const escapedText = text.replace(/,/g, '\\,').replace(/:/g, '\\:');
      return `(id:${urnId},text:${escapedText},selectionType:INCLUDED,parent:(id:0))`;
    }).join(',');

    filters.push(`(type:CURRENT_COMPANY,values:List(${companyValues}))`);
  }

  // Add location filter (REGION) - only use resolved numeric IDs
  let locationIds: string[] = [];
  const locationDisplay: Array<{ id: string; title: string }> =
    params.location_display || [];

  if (params.location) {
    // Sales Navigator uses include/exclude structure
    if (params.location.include && Array.isArray(params.location.include)) {
      locationIds = params.location.include.filter((id) => {
        // Only include resolved IDs (numeric or URN)
        return typeof id === 'string' && id.trim() && isResolvedId(id);
      });
    }
  }

  if (locationIds.length > 0) {
    const locationValues = locationIds.map((id: string) => {
      // Try to find display name
      const displayInfo = locationDisplay.find((d) => d.id === id);
      const text = displayInfo?.title || 'Unknown';
      // Escape commas and special characters in text
      const escapedText = text.replace(/,/g, '\\,').replace(/:/g, '\\:');
      return `(id:${id},text:${escapedText},selectionType:INCLUDED)`;
    }).join(',');

    filters.push(`(type:REGION,values:List(${locationValues}))`);
  }

  // Build query parts
  queryParts.push('spellCorrectionEnabled:true');

  if (filters.length > 0) {
    queryParts.push(`filters:List(${filters.join(',')})`);
  }

  // Add keywords if present
  if (
    params.keywords &&
    typeof params.keywords === 'string' &&
    params.keywords.trim()
  ) {
    // Keywords in Sales Navigator: if they contain OR/AND, wrap in quotes and parentheses
    const keywords = params.keywords.trim();
    // Check if keywords contain boolean operators
    const hasBooleanOps = /(OR|AND|NOT)/i.test(keywords);
    const keywordValue = hasBooleanOps ? `(${keywords})` : keywords;
    queryParts.push(`keywords:${keywordValue}`);
  }

  if (queryParts.length === 0) {
    return null;
  }

  // Build the query parameter
  const query = `(${queryParts.join(',')})`;

  // URL encode the query (Sales Navigator uses standard URL encoding)
  const encodedQuery = encodeURIComponent(query);

  return `${baseUrl}?query=${encodedQuery}`;
}

