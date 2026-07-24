import type { LinkedinXraySearchEngine } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';
import type { OrgchartSearchMode } from 'twenty-shared';

export type OrgchartLinkedinXrayBuildJobData = {
  apiToken: string;
  requestId?: string;
  rawQuery: string;
  cleanedQuery: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  mode: OrgchartSearchMode;
  companyName: string;
  companyId?: string;
  jobTitles?: string[];
  country?: string;
  functionRoot?: string;
  stdFunction?: string;
  stdGrade?: string;
  selectedNodeStdScopes?: Array<{ stdFunction?: string; stdGrade?: string }>;
  linkedinCompanyUrl?: string;
  businessDivisionRawQuery?: string;
  xraySearchEngine?: LinkedinXraySearchEngine;
  includePaginatedHtml?: boolean;
  shouldWriteCompanyOrgChartCache: boolean;
};
