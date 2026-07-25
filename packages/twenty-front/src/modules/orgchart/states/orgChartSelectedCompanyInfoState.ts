import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

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
  createAtomState<OrgChartSelectedCompanyInfo | null>({
    key: 'orgChartSelectedCompanyInfoState',
    defaultValue: null,
  });
