export type OrgchartApifyBuildJobData = {
  apiToken: string;
  requestId?: string;
  rawQuery: string;
  cleanedQuery: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  mode: 'entire_company' | 'all_people';
  companyName: string;
  companyId?: string;
  jobTitles?: string[];
  country?: string;
  functionRoot?: string;
  linkedinCompanyUrl: string;
  maxItems: number;
  profileScraperMode?: string;
  shouldWriteCompanyOrgChartCache: boolean;
};
