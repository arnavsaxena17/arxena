export type SuperImposeFetchSource = 'company_page' | 'linkedin_search';

export type SuperImposeResolvedCompany = {
  slug: string;
  linkedinUrl: string;
  resolvedFrom: 'linkedin_url' | 'website_url' | 'primary_chart';
  companyName?: string;
  error?: string;
};

export type SuperImposeInputs = {
  linkedinCompanyUrls?: string[];
  websiteUrls?: string[];
  salesNavigatorSearchUrls?: string[];
  linkedinSearchKeywords?: string;
  appendToExistingChart?: boolean;
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
  resolvedCompanies: SuperImposeResolvedCompany[];
  salesNavigatorSearchUrls: string[];
  harvestBatches: SuperImposeHarvestQueryParams[];
  useLinkedinSearchForCompanies: boolean;
  sessionId: string;
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
