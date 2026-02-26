import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';

import { CompanySearchAutocomplete } from '~/lib/company-search';

type OrgChartCompanySearchWrapperProps = {
  onCompanySelect: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  startIcon?: React.ReactNode;
};

export const OrgChartCompanySearchWrapper = ({
  onCompanySelect,
  placeholder = 'Search company for org charts...',
  disabled = false,
  startIcon,
}: OrgChartCompanySearchWrapperProps) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? undefined;
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

  return (
    <CompanySearchAutocomplete
      onCompanySelect={onCompanySelect}
      placeholder={placeholder}
      disabled={disabled}
      baseUrl={baseUrl}
      accessToken={accessToken}
      startIcon={startIcon}
    />
  );
};
