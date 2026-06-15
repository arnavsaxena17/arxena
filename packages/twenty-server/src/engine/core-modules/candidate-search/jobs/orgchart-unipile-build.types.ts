import type { OrgchartSearchMode } from 'twenty-shared';

export type OrgchartUnipileBuildJobData = {
  apiToken: string;
  requestId?: string;
  multiSource?: boolean;
  sources?: string[];
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
  linkedinUnipileAccountId?: string;
  businessDivisionRawQuery?: string;
  /** Raw industry label (e.g. "Computer Software") forwarded to Python list_data.industry */
  industry?: string;
  /** Macro category override forwarded to Python list_data.industry_category */
  industryCategory?: string;
  shouldWriteCompanyOrgChartCache: boolean;
};
