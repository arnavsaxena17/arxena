import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';

import { LINKEDIN_RATE_LIMIT_PENDING_REASON } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  readWorkflowRunStepPendingReason,
  readWorkflowRunStepScheduledAt,
} from 'src/engine/core-modules/outreach-command/utils/read-workflow-run-step-pending-fields.util';
import {
  WorkflowRunCurrentStepKind,
  WorkflowRunStatus,
  type WorkflowRunState,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

export { WorkflowRunCurrentStepKind };

export type WorkflowRunProgressFields = {
  currentStepName: string | null;
  currentStepKind: WorkflowRunCurrentStepKind | null;
  resumeAt: string | null;
  upcomingSteps: string | null;
};

const TERMINAL_RUN_STATUSES: WorkflowRunStatus[] = [
  WorkflowRunStatus.COMPLETED,
  WorkflowRunStatus.FAILED,
  WorkflowRunStatus.STOPPED,
];

const ACTIVE_STEP_STATUSES: StepStatus[] = [
  StepStatus.RUNNING,
  StepStatus.PENDING,
];

const joinNames = (names: string[]): string | null => {
  const uniqueNames = names.filter((name) => name.length > 0);

  return uniqueNames.length > 0 ? uniqueNames.join(', ') : null;
};

const resolvePendingKind = ({
  stepType,
  pendingReason,
}: {
  stepType: string;
  pendingReason?: string;
}): WorkflowRunCurrentStepKind => {
  if (pendingReason === LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return WorkflowRunCurrentStepKind.RATE_LIMITED;
  }

  if (stepType === WorkflowActionType.DELAY) {
    return WorkflowRunCurrentStepKind.DELAY;
  }

  if (stepType === WorkflowActionType.FORM) {
    return WorkflowRunCurrentStepKind.FORM;
  }

  return WorkflowRunCurrentStepKind.PENDING;
};

export const computeWorkflowRunProgressFields = ({
  state,
  status,
}: {
  state: WorkflowRunState | null | undefined;
  status: WorkflowRunStatus;
}): WorkflowRunProgressFields => {
  if (TERMINAL_RUN_STATUSES.includes(status)) {
    return {
      currentStepName: null,
      currentStepKind: null,
      resumeAt: null,
      upcomingSteps: null,
    };
  }

  const steps = state?.flow?.steps ?? [];
  const stepInfos = state?.stepInfos ?? {};

  const activeSteps = steps.filter((step) =>
    ACTIVE_STEP_STATUSES.includes(stepInfos[step.id]?.status as StepStatus),
  );
  const pendingSteps = activeSteps.filter(
    (step) => stepInfos[step.id]?.status === StepStatus.PENDING,
  );
  const runningSteps = activeSteps.filter(
    (step) => stepInfos[step.id]?.status === StepStatus.RUNNING,
  );
  const upcomingSteps = steps.filter(
    (step) =>
      !stepInfos[step.id]?.status ||
      stepInfos[step.id]?.status === StepStatus.NOT_STARTED,
  );

  const currentSteps = pendingSteps.length > 0 ? pendingSteps : runningSteps;

  let currentStepKind: WorkflowRunCurrentStepKind | null = null;

  if (pendingSteps.length > 0) {
    const kinds = pendingSteps.map((step) =>
      resolvePendingKind({
        stepType: step.type,
        pendingReason: readWorkflowRunStepPendingReason(stepInfos[step.id] ?? {}),
      }),
    );

    currentStepKind = kinds.includes(WorkflowRunCurrentStepKind.RATE_LIMITED)
      ? WorkflowRunCurrentStepKind.RATE_LIMITED
      : kinds.includes(WorkflowRunCurrentStepKind.FORM)
        ? WorkflowRunCurrentStepKind.FORM
        : kinds.includes(WorkflowRunCurrentStepKind.DELAY)
          ? WorkflowRunCurrentStepKind.DELAY
          : WorkflowRunCurrentStepKind.PENDING;
  } else if (runningSteps.length > 0) {
    currentStepKind = WorkflowRunCurrentStepKind.EXECUTING;
  }

  const resumeAt =
    pendingSteps
      .map((step) => readWorkflowRunStepScheduledAt(stepInfos[step.id] ?? {}))
      .find((scheduledAt) => typeof scheduledAt === 'string') ?? null;

  return {
    currentStepName: joinNames(currentSteps.map((step) => step.name)),
    currentStepKind,
    resumeAt,
    upcomingSteps: joinNames(upcomingSteps.map((step) => step.name)),
  };
};
