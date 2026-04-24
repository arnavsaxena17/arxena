import { createState } from '@ui/utilities/state/utils/createState';

export type OrgChartSelectedCompanyInfo = {
  companyId: string;
  companyName: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
};

export const orgChartSelectedCompanyInfoState =
  createState<OrgChartSelectedCompanyInfo | null>({
    key: 'orgChartSelectedCompanyInfoState',
    defaultValue: null,
  });

