import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useStopOutreach = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const outreachContext = useAtomStateValue(outreachContextState);
  const tokenPair = useAtomStateValue(tokenPairState);
  const [isStopping, setIsStopping] = useState(false);

  const projectId = outreachContext.projectId;

  const stopOutreachForCandidates = useCallback(
    async (
      candidateIds: string[],
      projectIdOverride?: string | null,
    ) => {
      const resolvedProjectId = projectIdOverride ?? projectId;

      if (!isDefined(resolvedProjectId)) {
        enqueueErrorSnackBar({
          message: 'Select a project before stopping outreach',
        });
        return false;
      }

      const uniqueCandidateIds = [...new Set(candidateIds.filter(Boolean))];

      if (uniqueCandidateIds.length === 0) {
        enqueueErrorSnackBar({
          message: 'Select enrolled people to stop outreach',
        });
        return false;
      }

      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!accessToken) {
        enqueueErrorSnackBar({
          message: 'Sign in again to stop outreach',
        });
        return false;
      }

      setIsStopping(true);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/projects/${resolvedProjectId}/candidates/stop`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ candidateIds: uniqueCandidateIds }),
          },
        );

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            message?: string;
            error?: string;
          } | null;

          throw new Error(
            result?.message ??
              result?.error ??
              `Failed to stop outreach (${response.status})`,
          );
        }

        enqueueSuccessSnackBar({
          message:
            uniqueCandidateIds.length === 1
              ? 'Stopped outreach for 1 person'
              : `Stopped outreach for ${uniqueCandidateIds.length} people`,
        });

        return true;
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to stop outreach',
        });
        return false;
      } finally {
        setIsStopping(false);
      }
    },
    [
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      projectId,
      tokenPair?.accessOrWorkspaceAgnosticToken?.token,
    ],
  );

  return {
    isStopping,
    stopOutreachForCandidates,
  };
};
