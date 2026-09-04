import type { LinkedInSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

export const ORG_CHART_UNIPILE_RAW_S3_VARIANT = 'unipile_raw';
export const ORG_CHART_UNIPILE_RAW_SEARCH_FILENAME = 'unipile-raw-search.json';

export type OrgChartUnipileRawSearchPayload = {
  version: 1;
  savedAt: string;
  companyId?: string;
  companyName?: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  mode?: string;
  functionRoot?: string;
  country?: string;
  requestId?: string;
  itemCount: number;
  items: LinkedInSearchResult[];
};
