import { useCallback, useEffect, useState } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { fetchOutreachProjectJourneySummary } from '@/outreach-home/utils/outreachJourneyApi';
import { type OutreachProjectJourneySummary } from '@/outreach-home/types/outreach-journey.types';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isDefined } from 'twenty-shared/utils';

export const useOutreachProjectJourneySummary = (
  projectId: string | null | undefined,
) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const [summary, setSummary] = useState<OutreachProjectJourneySummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const accessToken =
    tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

  const refetch = useCallback(async () => {
    if (!isDefined(projectId) || !accessToken) {
      setSummary(null);
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchOutreachProjectJourneySummary({
        projectId,
        accessToken,
      });
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { summary, isLoading, refetch };
};
