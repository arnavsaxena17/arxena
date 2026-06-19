export type SuperImposeFetchSource = 'company_page' | 'linkedin_search';

export type SuperImposeResolvedCompany = {
  slug: string;
  linkedinUrl: string;
  resolvedFrom: 'linkedin_url' | 'website_url' | 'primary_chart';
  companyName?: string;
  error?: string;
};

export type SuperImposeLinkedInFacetSelection = {
  id: string;
  title: string;
  pictureUrl?: string;
};

export type SuperImposeTargetCompany = SuperImposeLinkedInFacetSelection & {
  slug: string;
  linkedinCompanyUrl: string;
  profileUrl?: string;
  industry?: string;
  locationLabel?: string;
  headcount?: string;
};

export type SuperImposeTargetLocation = SuperImposeLinkedInFacetSelection;

export type SuperImposeInputs = {
  linkedinCompanyUrls?: string[];
  websiteUrls?: string[];
  salesNavigatorSearchUrls?: string[];
  linkedinSearchKeywords?: string;
  appendToExistingChart?: boolean;
  targetCompany?: SuperImposeTargetCompany;
  targetLocation?: SuperImposeTargetLocation;
};

export type SuperImposeManifest = {
  version: 1;
  primaryCompanyId: string;
  primaryCompanyName: string;
  primaryLinkedinCompanyUrl?: string;
  builtAt: string;
  candidateSource: 'harvest' | 'unipile';
  inputs: {
    linkedinCompanyUrls: string[];
    websiteUrls: string[];
    salesNavigatorSearchUrls: string[];
    linkedinSearchKeywords?: string | null;
    businessDivisionRawQuery?: string | null;
    country?: string;
    functionRoot?: string;
    appendToExistingChart?: boolean;
    targetCompany?: SuperImposeTargetCompany | null;
    targetLocation?: SuperImposeTargetLocation | null;
  };
  resolvedSources: SuperImposeResolvedCompany[];
  stats: {
    totalCandidates: number;
    duplicatesRemoved?: number;
    sourcesFetched: number;
  };
};

export type SuperImposeHarvestQueryParams = {
  currentCompanies?: string;
  salesNavUrl?: string;
  search?: string;
  locations?: string;
  geoIds?: string;
  functionIds?: string;
  sessionId: string;
  page: number;
};

export type SuperImposeQueryPlan = {
  mode: 'entire_company' | 'function_grade';
  candidateSource: 'harvest' | 'unipile';
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  mergedSearchClause?: string;
  /** LinkedIn-searchable company names for a single combined people query */
  companySearchNames: string[];
  resolvedCompanies: SuperImposeResolvedCompany[];
  salesNavigatorSearchUrls: string[];
  harvestBatches: SuperImposeHarvestQueryParams[];
  useLinkedinSearchForCompanies: boolean;
  sessionId: string;
  country?: string;
  functionRoot?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  linkedinCompanyParameterId?: string;
  apiToken?: string;
  linkedinUnipileAccountId?: string;
};

export type SuperImposeEstimatePerSource = {
  slug: string;
  sourceType: SuperImposeFetchSource;
  count: number;
  error?: string;
};

export type SuperImposeEstimateResult = {
  estimatedTotal: number;
  estimatedTotalUpperBound: number;
  perSource: SuperImposeEstimatePerSource[];
  threshold: number;
  thresholdExceeded: boolean;
  scopeRequired: boolean;
};

export type SuperImposeAutocompleteItem = {
  id: string;
  title: string;
  pictureUrl?: string;
  profileUrl?: string;
  slug?: string;
  industry?: string;
  locationLabel?: string;
  headcount?: string;
};
