import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import {
  ACCOUNT_RATE_LIMIT_SNACKBAR_KEY_PREFIX,
  collectAccountRateLimitQueuedEvents,
  formatAccountRateLimitQueuedSnackBarMessage,
} from '@/unipile/utils/accountRateLimitError';
import { useWorkflowRun } from '@/workflow/hooks/useWorkflowRun';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const WorkflowRunRateLimitSnackBarEffect = ({
  workflowRunId,
}: {
  workflowRunId: string;
}) => {
  const workflowRun = useWorkflowRun({ workflowRunId });
  const { enqueueInfoSnackBar } = useSnackBar();

  useEffect(() => {
    if (!isDefined(workflowRun?.state)) {
      return;
    }

    const queuedEvents = collectAccountRateLimitQueuedEvents(workflowRun.state);

    for (const queued of queuedEvents) {
      enqueueInfoSnackBar({
        message: formatAccountRateLimitQueuedSnackBarMessage(queued.waitMs),
        options: {
          duration: 12000,
          dedupeKey: `${ACCOUNT_RATE_LIMIT_SNACKBAR_KEY_PREFIX}-queued-${workflowRunId}-${queued.waitMs}`,
        },
      });
    }
  }, [enqueueInfoSnackBar, workflowRun?.state, workflowRunId]);

  return null;
};
