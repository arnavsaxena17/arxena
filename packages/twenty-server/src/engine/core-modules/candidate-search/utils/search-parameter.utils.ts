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
 * Generates a LinkedIn search URL from search parameters
 * @param params - The search parameters (keywords, company, location, etc.)
 * @param searchType - The search type (classic, sales_navigator, recruiter)
 * @param searchCategory - The search category (people, companies, posts, jobs)
 * @returns The LinkedIn search URL or null if parameters are invalid
 */
export function generateLinkedInSearchUrl(
  params: any,
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  searchCategory: 'people' | 'companies' | 'posts' | 'jobs',
): string | null {
  if (!params || typeof params !== 'object') {
    return null;
  }

  // Handle Sales Navigator format
  if (searchType === 'sales_navigator' && searchCategory === 'people') {
    return generateSalesNavigatorUrl(params);
  }

  // Handle Classic LinkedIn format
  if (searchType === 'classic' && searchCategory === 'people') {
    return generateClassicLinkedInUrl(params);
  }

  // Other types not supported yet
  return null;
}

/**
 * Generates a Classic LinkedIn search URL
 */
function generateClassicLinkedInUrl(params: any): string | null {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const queryParams: string[] = [];

  // Add keywords if present
  if (params.keywords && typeof params.keywords === 'string' && params.keywords.trim()) {
    queryParams.push(`keywords=${encodeURIComponent(params.keywords.trim())}`);
  }

  // Add location (geoUrn) if present
  let locationIds: string[] = [];
  if (params.location) {
    if (Array.isArray(params.location)) {
      locationIds = params.location.filter((id: any) => typeof id === 'string' && id.trim());
    } else if (params.location.include && Array.isArray(params.location.include)) {
      locationIds = params.location.include.filter((id: any) => typeof id === 'string' && id.trim());
    }
  }

  if (locationIds.length > 0) {
    const locationArray = JSON.stringify(locationIds);
    queryParams.push(`geoUrn=${encodeURIComponent(locationArray)}`);
  }

  // Add company (currentCompany) if present
  let companyIds: string[] = [];
  if (params.company) {
    if (Array.isArray(params.company)) {
      companyIds = params.company.filter((id: any) => typeof id === 'string' && id.trim());
    } else if (params.company.include && Array.isArray(params.company.include)) {
      companyIds = params.company.include.filter((id: any) => typeof id === 'string' && id.trim());
    } else if (typeof params.company === 'object' && params.company.id) {
      companyIds = [params.company.id];
    }
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
 * Generates a Sales Navigator search URL
 * Format: https://www.linkedin.com/sales/search/people?query=(...)
 * 
 * Query structure:
 * (spellCorrectionEnabled:true,filters:List((type:CURRENT_COMPANY,values:List((id:urn:li:organization:1406,text:Novartis,selectionType:INCLUDED,parent:(id:0)))),(type:REGION,values:List((id:106164952,text:Mumbai, Maharashtra, India,selectionType:INCLUDED)))),keywords:("sales manager" OR "area sales manager"))
 */
function generateSalesNavigatorUrl(params: any): string | null {
  const baseUrl = 'https://www.linkedin.com/sales/search/people';
  const queryParts: string[] = [];

  // Build filters list
  const filters: string[] = [];

  // Add company filter (CURRENT_COMPANY)
  let companyIds: string[] = [];
  let companyDisplay: Array<{ id: string; title: string }> = [];
  
  if (params.company) {
    if (Array.isArray(params.company)) {
      companyIds = params.company.filter((id: any) => typeof id === 'string' && id.trim());
    } else if (params.company.include && Array.isArray(params.company.include)) {
      companyIds = params.company.include.filter((id: any) => typeof id === 'string' && id.trim());
    }
  }

  // Get company display names if available
  if (params.company_display && Array.isArray(params.company_display)) {
    companyDisplay = params.company_display;
  }

  // Convert company IDs to URN format (urn:li:organization:ID)
  if (companyIds.length > 0) {
    const companyValues = companyIds.map((id: string) => {
      // Convert numeric ID to URN format
      const urnId = id.startsWith('urn:li:organization:') ? id : `urn:li:organization:${id}`;
      // Try to find display name
      const displayInfo = companyDisplay.find((d: any) => d.id === id);
      const text = displayInfo?.title || 'Unknown';
      // Escape commas and special characters in text
      const escapedText = text.replace(/,/g, '\\,').replace(/:/g, '\\:');
      return `(id:${urnId},text:${escapedText},selectionType:INCLUDED,parent:(id:0))`;
    }).join(',');
    
    filters.push(`(type:CURRENT_COMPANY,values:List(${companyValues}))`);
  }

  // Add location filter (REGION)
  let locationIds: string[] = [];
  let locationDisplay: Array<{ id: string; title: string }> = [];
  
  if (params.location) {
    if (Array.isArray(params.location)) {
      locationIds = params.location.filter((id: any) => typeof id === 'string' && id.trim());
    } else if (params.location.include && Array.isArray(params.location.include)) {
      locationIds = params.location.include.filter((id: any) => typeof id === 'string' && id.trim());
    }
  }

  // Get location display names if available
  if (params.location_display && Array.isArray(params.location_display)) {
    locationDisplay = params.location_display;
  }

  if (locationIds.length > 0) {
    const locationValues = locationIds.map((id: string) => {
      // Try to find display name
      const displayInfo = locationDisplay.find((d: any) => d.id === id);
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
  if (params.keywords && typeof params.keywords === 'string' && params.keywords.trim()) {
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

