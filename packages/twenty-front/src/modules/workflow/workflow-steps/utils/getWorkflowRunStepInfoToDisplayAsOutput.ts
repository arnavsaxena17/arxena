import {
  formatWorkflowPendingDisplay,
  formatWorkflowPendingSubtitle,
  getWorkflowPendingQueuedEvent,
} from '@/unipile/utils/accountRateLimitError';
import { type WorkflowRunStepInfo } from 'twenty-shared/workflow';

export const getWorkflowRunStepInfoToDisplayAsOutput = ({
  stepInfo,
}: {
  stepInfo: WorkflowRunStepInfo;
}) => {
  const queued = getWorkflowPendingQueuedEvent(stepInfo);

  if (queued) {
    return formatWorkflowPendingDisplay(queued);
  }

  const { status: _status, history: _history, ...infoToDisplay } = stepInfo;

  return infoToDisplay;
};
