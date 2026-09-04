import { useEffect } from 'react';

import { orgChartBrowsingContextState } from '@/orgchart/states/orgChartBrowsingContextState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

export const useSyncOrgChartBrowsingContext = ({
  companyId,
  companyName,
  country,
  functionRoot,
  titleQuery,
  searchTerm,
}: {
  companyId: string;
  companyName?: string;
  country?: string;
  functionRoot?: string;
  titleQuery: string;
  searchTerm: string;
}) => {
  const setOrgChartBrowsingContext = useSetAtomState(
    orgChartBrowsingContextState,
  );

  useEffect(() => {
    setOrgChartBrowsingContext({
      companyId: companyId.trim() || null,
      companyName: companyName?.trim() || null,
      country: country?.trim() || null,
      functionRoot: functionRoot?.trim() || null,
      titleQuery: titleQuery.trim() || null,
      searchTerm: searchTerm.trim() || null,
    });

    return () => {
      setOrgChartBrowsingContext(null);
    };
  }, [
    companyId,
    companyName,
    country,
    functionRoot,
    titleQuery,
    searchTerm,
    setOrgChartBrowsingContext,
  ]);
};
