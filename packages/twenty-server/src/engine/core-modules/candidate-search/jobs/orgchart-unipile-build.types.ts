export type OrgchartUnipileBuildJobData = {
  apiToken: string;
  requestId?: string;
  rawQuery: string;
  cleanedQuery: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  mode:
    | 'current_node'
    | 'leadership'
    | 'entire_company'
    | 'function_grade'
    | 'business_division_map'
    | 'selected_nodes';
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
  shouldWriteCompanyOrgChartCache: boolean;
};
