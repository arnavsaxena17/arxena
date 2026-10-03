import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  type OutreachDecisionListItem,
  type OutreachDecisionResolution,
} from '@/outreach-today/types/outreach-decision.types';
import {
  fetchOpenOutreachDecisions,
  resolveOutreachDecision,
} from '@/outreach-today/utils/outreach-decision-api';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useOutreachDecisions = ({
  candidateId,
  enabled = true,
}: {
  candidateId?: string | null;
  enabled?: boolean;
} = {}) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const [decisions, setDecisions] = useState<OutreachDecisionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const accessToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

  const refetch = useCallback(async () => {
    if (!enabled || !accessToken) {
      setDecisions([]);

      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchOpenOutreachDecisions({
        accessToken,
        candidateId: isDefined(candidateId) ? candidateId : undefined,
      });

      setDecisions(data);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to load decisions',
      });
      setDecisions([]);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, candidateId, enabled, enqueueErrorSnackBar]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const resolve = useCallback(
    async ({
      decisionId,
      resolution,
      editedBody,
    }: {
      decisionId: string;
      resolution: OutreachDecisionResolution;
      editedBody?: string;
    }): Promise<boolean> => {
      if (!accessToken) {
        return false;
      }

      setResolvingId(decisionId);

      try {
        await resolveOutreachDecision({
          accessToken,
          decisionId,
          resolution,
          editedBody,
        });
        enqueueSuccessSnackBar({
          message:
            resolution === 'REJECTED' ? 'Draft rejected' : 'Draft approved',
        });
        await refetch();

        return true;
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to resolve decision',
        });

        return false;
      } finally {
        setResolvingId(null);
      }
    },
    [accessToken, enqueueErrorSnackBar, enqueueSuccessSnackBar, refetch],
  );

  return { decisions, isLoading, resolvingId, refetch, resolve };
};
