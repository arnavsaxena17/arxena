import { type WorkflowRunStepInfo } from 'twenty-shared/workflow';

const DEFERRAL_FIELD_KEYS = [
  'pendingReason',
  'waitMs',
  'scheduledAt',
  'remainingMs',
  'method',
] as const;

const stripDeferralFieldsFromResult = (result: unknown): unknown => {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return result;
  }

  const nextResult = { ...(result as Record<string, unknown>) };

  for (const key of DEFERRAL_FIELD_KEYS) {
    delete nextResult[key];
  }

  return Object.keys(nextResult).length > 0 ? nextResult : undefined;
};

// Merge step patches; explicit `undefined` deletes the key so stale pause /
// rate-limit metadata does not survive FORM re-park or resume.
export const mergeWorkflowRunStepInfo = (
  existing: WorkflowRunStepInfo | undefined,
  patch: WorkflowRunStepInfo,
): WorkflowRunStepInfo => {
  const merged: Record<string, unknown> = {
    ...(existing as Record<string, unknown> | undefined),
    ...(patch as Record<string, unknown>),
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete merged[key];
    }
  }

  if ('pendingReason' in patch && patch.pendingReason === undefined) {
    const strippedResult = stripDeferralFieldsFromResult(merged.result);

    if (strippedResult === undefined) {
      delete merged.result;
    } else {
      merged.result = strippedResult;
    }
  }

  return merged as WorkflowRunStepInfo;
};
