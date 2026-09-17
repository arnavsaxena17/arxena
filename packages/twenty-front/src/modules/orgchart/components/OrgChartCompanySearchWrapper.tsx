import { type FocusEvent, useCallback } from 'react';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { orgChartSelectedCompanyInfoState } from '@/orgchart/states/orgChartSelectedCompanyInfoState';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
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
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();
  const autocompletePath = '/org-chart/companies/autocomplete';
  // const autocompletePathM7kq = '/org-chart/companies/autocomplete-m7kq';
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

  // Go-to hotkeys (`g` then …) use preventDefault; disable them while typing.
  const handleFocus = useCallback(() => {
    pushFocusItemToFocusStack({
      focusId: ORG_CHART_COMPANY_SEARCH_FOCUS_ID,
      component: {
        type: FocusComponentType.TEXT_INPUT,
        instanceId: ORG_CHART_COMPANY_SEARCH_FOCUS_ID,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });
  }, [pushFocusItemToFocusStack]);

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }

      removeFocusItemFromFocusStackById({
        focusId: ORG_CHART_COMPANY_SEARCH_FOCUS_ID,
      });
    },
    [removeFocusItemFromFocusStackById],
  );

  return (
    <div onFocus={handleFocus} onBlur={handleBlur}>
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
