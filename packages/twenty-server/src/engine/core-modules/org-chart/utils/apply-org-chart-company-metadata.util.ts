import { OrgChartData } from 'twenty-shared';

export type OrgChartCompanyMetadataInput = {
  website?: string;
  linkedinCompanyUrl?: string;
};

export const applyOrgChartCompanyMetadata = (
  orgChart: OrgChartData,
  metadata: OrgChartCompanyMetadataInput,
): OrgChartData => {
  const website = metadata.website?.trim();
  const linkedinUrl = metadata.linkedinCompanyUrl?.trim().replace(/\/+$/, '');

  if (!website && !linkedinUrl) {
    return orgChart;
  }

  return {
    ...orgChart,
    ...(website ? { job_company_website: website } : {}),
    ...(linkedinUrl ? { job_company_linkedin_url: linkedinUrl } : {}),
  };
};
