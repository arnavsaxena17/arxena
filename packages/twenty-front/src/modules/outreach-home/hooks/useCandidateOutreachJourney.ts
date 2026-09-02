import { useCallback, useEffect, useState } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  approveCandidateOutreachFormStep,
  fetchCandidateOutreachJourney,
  pauseCandidateOutreachJourney,
  resumeCandidateOutreachJourney,
  skipCandidateOutreachDelayStep,
  snoozeCandidateOutreachJourney,
} from '@/outreach-home/utils/outreachJourneyApi';
import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isDefined } from 'twenty-shared/utils';

export const useCandidateOutreachJourney = ({
  projectId,
  candidateId,
  enabled = true,
}: {
  projectId: string | null | undefined;
  candidateId: string | null | undefined;
  enabled?: boolean;
}) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const [journey, setJourney] = useState<CandidateOutreachJourney | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const accessToken =
    tokenPair?.accessOrWorkspaceAgnosticToken?.token ?? '';

  const refetch = useCallback(async () => {
    if (
      !enabled ||
      !isDefined(projectId) ||
      !isDefined(candidateId) ||
      !accessToken
    ) {
      setJourney(null);
      return;
    }

    setIsLoading(true);

    try {
      const data = await fetchCandidateOutreachJourney({
        projectId,
        candidateId,
        accessToken,
      });
      setJourney(data);
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load outreach journey',
      });
      setJourney(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    candidateId,
    enabled,
    enqueueErrorSnackBar,
    projectId,
  ]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      setIsActionLoading(true);

      try {
        await action();
        enqueueSuccessSnackBar({ message: successMessage });
        await refetch();
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Outreach action failed',
        });
      } finally {
        setIsActionLoading(false);
      }
    },
    [enqueueErrorSnackBar, enqueueSuccessSnackBar, refetch],
  );

  const pauseJourney = useCallback(async () => {
    if (!projectId || !candidateId || !accessToken) {
      return;
    }

    await runAction(async () => {
      await pauseCandidateOutreachJourney({
        projectId,
        candidateId,
        accessToken,
      });
    }, 'Outreach journey paused');
  }, [accessToken, candidateId, projectId, runAction]);

  const resumeJourney = useCallback(async () => {
    if (!projectId || !candidateId || !accessToken) {
      return;
    }

    await runAction(async () => {
      await resumeCandidateOutreachJourney({
        projectId,
        candidateId,
        accessToken,
      });
    }, 'Outreach journey resumed');
  }, [accessToken, candidateId, projectId, runAction]);

  const snoozeJourney = useCallback(
    async (resumeAt: string) => {
      if (!projectId || !candidateId || !accessToken) {
        return;
      }

      await runAction(async () => {
        await snoozeCandidateOutreachJourney({
          projectId,
          candidateId,
          resumeAt,
          accessToken,
        });
      }, 'Outreach snoozed');
    },
    [accessToken, candidateId, projectId, runAction],
  );

  const skipDelayStep = useCallback(
    async (workflowRunId: string, stepId: string) => {
      if (!projectId || !candidateId || !accessToken) {
        return;
      }

      await runAction(async () => {
        await skipCandidateOutreachDelayStep({
          projectId,
          candidateId,
          workflowRunId,
          stepId,
          accessToken,
        });
      }, 'Delay skipped — continuing outreach');
    },
    [accessToken, candidateId, projectId, runAction],
  );

  const approveFormStep = useCallback(
    async ({
      workflowRunId,
      stepId,
      editedBody,
      approve = true,
    }: {
      workflowRunId: string;
      stepId: string;
      editedBody: string;
      approve?: boolean;
    }) => {
      if (!projectId || !candidateId || !accessToken) {
        return;
      }

      await runAction(async () => {
        await approveCandidateOutreachFormStep({
          projectId,
          candidateId,
          workflowRunId,
          stepId,
          response: { approve, editedBody },
          accessToken,
        });
      }, approve ? 'Message approved and sent' : 'Message rejected');
    },
    [accessToken, candidateId, projectId, runAction],
  );

  return {
    journey,
    isLoading,
    isActionLoading,
    refetch,
    pauseJourney,
    resumeJourney,
    snoozeJourney,
    skipDelayStep,
    approveFormStep,
  };
};
