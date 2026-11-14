import { isNonEmptyString } from '@sniptt/guards';
import { StepStatus } from 'twenty-shared/workflow';

import { type WorkflowRunState } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

const MAX_ERROR_MESSAGE_LENGTH = 120;

export type WorkflowRunFailedStepSummary = {
  stepId: string | null;
  stepName: string | null;
  errorMessage: string | null;
};

const truncateErrorMessage = (errorMessage: string): string => {
  const firstLine = errorMessage.split('\n')[0]?.trim() ?? errorMessage.trim();

  if (firstLine.length <= MAX_ERROR_MESSAGE_LENGTH) {
    return firstLine;
  }

  return `${firstLine.slice(0, MAX_ERROR_MESSAGE_LENGTH - 1)}…`;
};

const readStepErrorMessage = (stepInfo: { error?: unknown }): string | null => {
  if (typeof stepInfo.error === 'string' && isNonEmptyString(stepInfo.error)) {
    return truncateErrorMessage(stepInfo.error);
  }

  return null;
};

export const extractWorkflowRunFailedStepSummary = ({
  state,
}: {
  state: WorkflowRunState | null | undefined;
}): WorkflowRunFailedStepSummary => {
  const empty: WorkflowRunFailedStepSummary = {
    stepId: null,
    stepName: null,
    errorMessage: null,
  };

  if (!state) {
    return empty;
  }

  const stepInfos = state.stepInfos ?? {};
  const steps = state.flow?.steps ?? [];

  for (const step of steps) {
    const stepInfo = stepInfos[step.id];

    if (
      stepInfo?.status !== StepStatus.FAILED &&
      stepInfo?.status !== StepStatus.FAILED_SAFELY
    ) {
      continue;
    }

    return {
      stepId: step.id,
      stepName: isNonEmptyString(step.name) ? step.name : null,
      errorMessage: readStepErrorMessage(stepInfo),
    };
  }

  for (const [stepId, stepInfo] of Object.entries(stepInfos)) {
    if (
      stepInfo.status !== StepStatus.FAILED &&
      stepInfo.status !== StepStatus.FAILED_SAFELY
    ) {
      continue;
    }

    const stepName = steps.find((step) => step.id === stepId)?.name ?? null;

    return {
      stepId,
      stepName: isNonEmptyString(stepName) ? stepName : null,
      errorMessage: readStepErrorMessage(stepInfo),
    };
  }

  return empty;
};

export const buildFailedRunSummaryFields = ({
  state,
}: {
  state: WorkflowRunState | null | undefined;
}): {
  currentStepName: string | null;
  currentStepKind: 'FAILED';
  errorMessage: string | null;
} => {
  const failedStep = extractWorkflowRunFailedStepSummary({ state });

  return {
    currentStepName: failedStep.stepName,
    currentStepKind: 'FAILED',
    errorMessage: failedStep.errorMessage,
  };
};
