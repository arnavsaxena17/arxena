import { useCallback } from 'react';

import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { orgChartsRefetchTriggerState } from '@/orgchart/states/orgChartsRefetchTriggerState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

const ORG_CHARTS_FIND_MANY_QUERY_NAME = 'FindManyOrgCharts';

// Refreshes the org charts list in the left navigation drawer
export const useOrgChartsRefetch = () => {
  const graphqlClient = useApolloCoreClient();
  const [orgChartsRefetchTrigger, setOrgChartsRefetchTrigger] = useAtomState(
    orgChartsRefetchTriggerState,
  );

  const refetchOrgCharts = useCallback(async () => {
    try {
      await graphqlClient.refetchQueries({
        include: [ORG_CHARTS_FIND_MANY_QUERY_NAME],
      });
    } catch (error) {
      console.error('Failed to refetch org charts nav list:', error);
    }
  }, [graphqlClient]);

  const triggerOrgChartsRefetch = useCallback(() => {
    setOrgChartsRefetchTrigger((previous) => previous + 1);
  }, [setOrgChartsRefetchTrigger]);

  return {
    refetchOrgCharts,
    triggerOrgChartsRefetch,
    orgChartsRefetchTrigger,
  };
};
