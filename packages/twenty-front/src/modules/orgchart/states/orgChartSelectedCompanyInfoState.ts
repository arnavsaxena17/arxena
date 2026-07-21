import { createState } from 'twenty-ui';

export type OrgChartSelectedCompanyInfo = {
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  companyDomain?: string;
};

export const orgChartSelectedCompanyInfoState =
  createState<OrgChartSelectedCompanyInfo | null>({
    key: 'orgChartSelectedCompanyInfoState',
    defaultValue: null,
  });

