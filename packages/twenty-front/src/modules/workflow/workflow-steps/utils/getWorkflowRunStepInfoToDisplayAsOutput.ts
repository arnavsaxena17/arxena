import {
  formatLinkedinRateLimitPendingDisplay,
  getLinkedinRateLimitQueuedEvent,
} from '@/unipile/utils/accountRateLimitError';
import { type WorkflowRunStepInfo } from 'twenty-shared/workflow';

export const getWorkflowRunStepInfoToDisplayAsOutput = ({
  stepInfo,
}: {
  stepInfo: WorkflowRunStepInfo;
}) => {
  const queued = getLinkedinRateLimitQueuedEvent(stepInfo);

  if (queued) {
    return formatLinkedinRateLimitPendingDisplay(queued);
  }

  const { status: _status, history: _history, ...infoToDisplay } = stepInfo;

  return infoToDisplay;
};
