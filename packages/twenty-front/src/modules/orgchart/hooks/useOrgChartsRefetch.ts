import { useApolloClient } from '@apollo/client';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

import { orgChartsRefetchTriggerState } from '@/orgchart/states/orgChartsRefetchTriggerState';

const ORG_CHARTS_FIND_MANY_QUERY_NAME = 'FindManyOrgCharts';

/**
 * Hook to refresh the org charts list shown in the left navigation drawer.
 *
 * - `refetchOrgCharts` directly refetches the active `FindManyOrgCharts` Apollo
 *   query (used by `OrgChartsNavigationDrawerItems`).
 * - `triggerOrgChartsRefetch` increments a recoil counter so callers that
 *   don't have Apollo context (or that want a pure state signal) can bump it
 *   and any subscriber will refetch accordingly.
 */
export const useOrgChartsRefetch = () => {
  const apolloClient = useApolloClient();
  const [orgChartsRefetchTrigger, setOrgChartsRefetchTrigger] = useRecoilState(
    orgChartsRefetchTriggerState,
  );

  const refetchOrgCharts = useCallback(async () => {
    try {
      await apolloClient.refetchQueries({
        include: [ORG_CHARTS_FIND_MANY_QUERY_NAME],
      });
    } catch (error) {
      console.error('Failed to refetch org charts nav list:', error);
    }
  }, [apolloClient]);

  const triggerOrgChartsRefetch = useCallback(() => {
    setOrgChartsRefetchTrigger((prev) => prev + 1);
  }, [setOrgChartsRefetchTrigger]);

  return {
    refetchOrgCharts,
    triggerOrgChartsRefetch,
    orgChartsRefetchTrigger,
  };
};
