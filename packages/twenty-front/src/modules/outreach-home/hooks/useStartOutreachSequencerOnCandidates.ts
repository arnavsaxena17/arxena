import { useCallback, useState } from 'react';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useStartOutreachSequencerOnCandidates = () => {
  const [isStarting, setIsStarting] = useState(false);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const outreachContext = useAtomStateValue(outreachContextState);
  const tokenPair = useAtomStateValue(tokenPairState);

  const projectId = outreachContext.projectId;

  const startSequencerOnCandidateIds = useCallback(
    async (candidateIds: string[]) => {
      const uniqueCandidateIds = [
        ...new Set(
          candidateIds.filter((candidateId) => isDefined(candidateId)),
        ),
      ];

      if (!isNonEmptyArray(uniqueCandidateIds)) {
        enqueueErrorSnackBar({
          message: 'Select enrolled people with candidates first',
        });

        return;
      }

      const accessToken =
        tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

      if (!accessToken) {
        enqueueErrorSnackBar({
          message: 'Sign in again to start outreach',
        });

        return;
      }

      setIsStarting(true);

      try {
        const response = await fetch(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/candidates/start-outreach`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              candidateIds: uniqueCandidateIds,
              ...(isDefined(projectId) ? { projectId } : {}),
            }),
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
              `Failed to start outreach (${response.status})`,
          );
        }

        const payload = (await response.json()) as {
          startedCandidates?: number;
        };

        const startedCount =
          payload.startedCandidates ?? uniqueCandidateIds.length;

        enqueueSuccessSnackBar({
          message:
            startedCount === 1
              ? 'Started outreach for 1 person'
              : `Started outreach for ${startedCount} people`,
        });
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Failed to start outreach',
        });
      } finally {
        setIsStarting(false);
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
    isStarting,
    startSequencerOnCandidateIds,
  };
};
