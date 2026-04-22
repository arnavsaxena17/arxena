import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { Mixpanel } from '~/mixpanel';

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
  const autocompletePath = '/org-chart/companies/autocomplete';
  // const autocompletePathApollo = '/org-chart/companies/autocomplete-apollo';
  const handleCompanySelect = useCallback(
    (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
    }) => {
      Mixpanel.track('org_chart_company_search', {
        companyId: company.companyId,
        companyName: company.companyName,
      });
      onCompanySelect(company);
    },
    [onCompanySelect],
  );

  return (
    <CompanySearchAutocomplete
      key={autocompletePath}
      onCompanySelect={handleCompanySelect}
      placeholder={placeholder}
      disabled={disabled}
      baseUrl={baseUrl}
      accessToken={accessToken}
      autocompletePath={autocompletePath}
      startIcon={startIcon}
    />
  );
};
