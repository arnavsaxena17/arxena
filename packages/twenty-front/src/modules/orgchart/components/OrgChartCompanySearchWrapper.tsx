import { type FocusEvent, useCallback } from 'react';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { orgChartSelectedCompanyInfoState } from '@/orgchart/states/orgChartSelectedCompanyInfoState';
import { useDisableConflictingHotkeysWhileFocused } from '@/ui/utilities/hotkey/hooks/useDisableConflictingHotkeysWhileFocused';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { Mixpanel } from '~/mixpanel';

import { CompanySearchAutocomplete } from '~/lib/company-search';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const ORG_CHART_COMPANY_SEARCH_FOCUS_ID =
  'org-chart-company-search-autocomplete';

type OrgChartCompanySearchWrapperProps = {
  onCompanySelect: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  startIcon?: React.ReactNode;
};

export const OrgChartCompanySearchWrapper = ({
  onCompanySelect,
  placeholder = "Search any company's org chart...",
  disabled = false,
  startIcon,
}: OrgChartCompanySearchWrapperProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const accessToken =
    tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? undefined;
  const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';
  const setOrgChartSelectedCompanyInfo = useSetAtomState(
    orgChartSelectedCompanyInfoState,
  );
  const { onFocus, onBlur } = useDisableConflictingHotkeysWhileFocused(
    ORG_CHART_COMPANY_SEARCH_FOCUS_ID,
  );
  const autocompletePath = '/org-chart/companies/autocomplete';
  const handleCompanySelect = useCallback(
    (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
      companyDomain?: string;
    }) => {
      Mixpanel.track('org_chart_search', {
        companyId: company.companyId,
        companyName: company.companyName,
        website: company.website,
        industry: company.industry,
      });
      setOrgChartSelectedCompanyInfo(company);
      onCompanySelect(company);
    },
    [onCompanySelect, setOrgChartSelectedCompanyInfo],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      onBlur(event);
    },
    [onBlur],
  );

  return (
    <div onFocus={onFocus} onBlur={handleBlur}>
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
    </div>
  );
};
