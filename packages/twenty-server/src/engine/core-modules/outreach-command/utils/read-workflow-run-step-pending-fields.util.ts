import { isNonEmptyString } from '@sniptt/guards';

import { normalizeOutreachPendingReason } from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';

type WorkflowRunStepDeferralFields = {
  pendingReason?: string;
  scheduledAt?: string;
  waitMs?: number;
  remainingMs?: number;
  result?: unknown;
};

export const readWorkflowRunStepPendingReason = (
  stepInfo: WorkflowRunStepDeferralFields,
): string | undefined => {
  const topLevelReason = normalizeOutreachPendingReason(stepInfo.pendingReason);

  if (isNonEmptyString(topLevelReason)) {
    return topLevelReason;
  }

  if (
    stepInfo.result &&
    typeof stepInfo.result === 'object' &&
    'pendingReason' in stepInfo.result &&
    typeof (stepInfo.result as { pendingReason?: unknown }).pendingReason ===
      'string'
  ) {
    return normalizeOutreachPendingReason(
      (stepInfo.result as { pendingReason: string }).pendingReason,
    );
  }

  return undefined;
};

export const readWorkflowRunStepScheduledAt = (
  stepInfo: WorkflowRunStepDeferralFields,
): string | undefined => {
  if (typeof stepInfo.scheduledAt === 'string') {
    return stepInfo.scheduledAt;
  }

  if (
    stepInfo.result &&
    typeof stepInfo.result === 'object' &&
    'scheduledAt' in stepInfo.result &&
    typeof (stepInfo.result as { scheduledAt?: unknown }).scheduledAt === 'string'
  ) {
    return (stepInfo.result as { scheduledAt: string }).scheduledAt;
  }

  return undefined;
};

export const normalizeWorkflowRunStepDeferralFields = (
  stepInfo: WorkflowRunStepDeferralFields,
): WorkflowRunStepDeferralFields => {
  const pendingReason = readWorkflowRunStepPendingReason(stepInfo);

  if (!isNonEmptyString(pendingReason)) {
    return stepInfo;
  }

  const result =
    stepInfo.result && typeof stepInfo.result === 'object'
      ? {
          ...(stepInfo.result as Record<string, unknown>),
          pendingReason,
        }
      : stepInfo.result;

  return {
    ...stepInfo,
    pendingReason,
    result,
  };
};
