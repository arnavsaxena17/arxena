export type OrgchartApolloBuildJobData = {
  apiToken: string;
  requestId: string;
  companyId: string;
  companyName: string;
  country?: string;
  functionRoot?: string;
  linkedinCompanyUrl?: string;
  companyDomain?: string;
  /** Lets the worker derive companyDomain when ORGCHART_APOLLO_SKIP_RESOLUTION is on. */
  website?: string;
  shouldWriteCompanyOrgChartCache: boolean;
};
