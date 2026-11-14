import { isDefined } from 'twenty-shared/utils';
import {
  StepStatus,
  WorkflowActionType,
  type WorkflowRunStepInfo,
} from 'twenty-shared/workflow';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const SEND_ACTION_TYPES = new Set<WorkflowActionType>([
  WorkflowActionType.SEND_EMAIL,
  WorkflowActionType.DRAFT_EMAIL,
  WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
  WorkflowActionType.SEND_LINKEDIN_INMAIL,
  WorkflowActionType.SEND_LINKEDIN_MESSAGE,
  WorkflowActionType.SEND_WHATSAPP_MESSAGE,
]);

const STALE_FORM_STATUSES = new Set<StepStatus>([
  StepStatus.PENDING,
  StepStatus.RUNNING,
]);

export type StaleFormAfterSendRepairPlan = {
  formStepId: string;
  sendStepId: string;
  // Resume from send when a direct next step never started (e.g. wait).
  continueFromSendStepId: string | null;
  repairedFormStepInfo: WorkflowRunStepInfo;
};

type WorkflowRunStateLike = {
  flow?: {
    steps?: WorkflowAction[] | null;
  } | null;
  stepInfos?: Record<string, WorkflowRunStepInfo> | null;
};

const findSuccessfulDownstreamSendStepId = ({
  startStepId,
  steps,
  stepInfos,
}: {
  startStepId: string;
  steps: WorkflowAction[];
  stepInfos: Record<string, WorkflowRunStepInfo>;
}): string | null => {
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const visitedStepIds = new Set<string>();
  const queue = [startStepId];

  while (queue.length > 0) {
    const currentStepId = queue.shift();

    if (!isDefined(currentStepId) || visitedStepIds.has(currentStepId)) {
      continue;
    }

    visitedStepIds.add(currentStepId);

    const currentStep = stepById.get(currentStepId);

    if (!isDefined(currentStep?.nextStepIds)) {
      continue;
    }

    for (const nextStepId of currentStep.nextStepIds) {
      const nextStep = stepById.get(nextStepId);

      if (!isDefined(nextStep)) {
        continue;
      }

      if (
        SEND_ACTION_TYPES.has(nextStep.type) &&
        stepInfos[nextStepId]?.status === StepStatus.SUCCESS
      ) {
        return nextStepId;
      }

      queue.push(nextStepId);
    }
  }

  return null;
};

const buildRepairedFormStepInfo = (
  existingStepInfo: WorkflowRunStepInfo | undefined,
): WorkflowRunStepInfo => {
  const existingResult =
    existingStepInfo?.result && typeof existingStepInfo.result === 'object'
      ? (existingStepInfo.result as Record<string, unknown>)
      : {};

  return {
    status: StepStatus.SUCCESS,
    result: {
      ...existingResult,
      repairedFromStalePending: true,
    },
  };
};

const resolveContinueFromSendStepId = ({
  sendStepId,
  steps,
  stepInfos,
}: {
  sendStepId: string;
  steps: WorkflowAction[];
  stepInfos: Record<string, WorkflowRunStepInfo>;
}): string | null => {
  const sendStep = steps.find((step) => step.id === sendStepId);

  if (!isDefined(sendStep?.nextStepIds) || sendStep.nextStepIds.length === 0) {
    return null;
  }

  const hasUnstartedNextStep = sendStep.nextStepIds.some((nextStepId) => {
    const nextStatus = stepInfos[nextStepId]?.status;

    return (
      !isDefined(nextStatus) ||
      nextStatus === StepStatus.NOT_STARTED
    );
  });

  return hasUnstartedNextStep ? sendStepId : null;
};

// Approve/FORM still PENDING|RUNNING while a downstream send already SUCCESS —
// usually from flow-version sync that reopened the form after send.
export const planStaleFormAfterSendRepairs = (
  state: WorkflowRunStateLike,
): StaleFormAfterSendRepairPlan[] => {
  const steps = state.flow?.steps ?? [];
  const stepInfos = state.stepInfos ?? {};

  if (steps.length === 0) {
    return [];
  }

  const repairs: StaleFormAfterSendRepairPlan[] = [];

  for (const step of steps) {
    if (step.type !== WorkflowActionType.FORM) {
      continue;
    }

    const formStepInfo = stepInfos[step.id];

    if (
      !isDefined(formStepInfo) ||
      !STALE_FORM_STATUSES.has(formStepInfo.status)
    ) {
      continue;
    }

    const sendStepId = findSuccessfulDownstreamSendStepId({
      startStepId: step.id,
      steps,
      stepInfos,
    });

    if (!isDefined(sendStepId)) {
      continue;
    }

    repairs.push({
      formStepId: step.id,
      sendStepId,
      continueFromSendStepId: resolveContinueFromSendStepId({
        sendStepId,
        steps,
        stepInfos,
      }),
      repairedFormStepInfo: buildRepairedFormStepInfo(formStepInfo),
    });
  }

  return repairs;
};
