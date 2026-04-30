export type OrgchartApolloBuildJobData = {
  apiToken: string;
  requestId: string;
  companyId: string;
  companyName: string;
  country?: string;
  functionRoot?: string;
  linkedinCompanyUrl?: string;
  companyDomain?: string;
  shouldWriteCompanyOrgChartCache: boolean;
};
