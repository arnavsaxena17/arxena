import { isDefined } from 'twenty-shared/utils';
import {
  StepStatus,
  WorkflowActionType,
  type WorkflowRunStepInfo,
} from 'twenty-shared/workflow';

import { type WorkflowRunState } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { type WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const CONTENT_BEARING_ACTION_TYPES = new Set<WorkflowActionType>([
  WorkflowActionType.AI_AGENT,
  WorkflowActionType.FORM,
  WorkflowActionType.SEND_EMAIL,
  WorkflowActionType.DRAFT_EMAIL,
  WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
  WorkflowActionType.SEND_LINKEDIN_INMAIL,
  WorkflowActionType.SEND_LINKEDIN_MESSAGE,
  WorkflowActionType.SEND_WHATSAPP_MESSAGE,
]);

const SEND_ACTION_TYPES = new Set<WorkflowActionType>([
  WorkflowActionType.SEND_EMAIL,
  WorkflowActionType.DRAFT_EMAIL,
  WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
  WorkflowActionType.SEND_LINKEDIN_INMAIL,
  WorkflowActionType.SEND_LINKEDIN_MESSAGE,
  WorkflowActionType.SEND_WHATSAPP_MESSAGE,
]);

export type MergeWorkflowRunFlowFromVersionInput = {
  currentState: WorkflowRunState;
  nextTrigger: WorkflowTrigger;
  nextSteps: WorkflowAction[];
};

export type MergeWorkflowRunFlowFromVersionResult = {
  state: WorkflowRunState;
  upgraded: boolean;
  resetStepIds: string[];
};

export const mergeWorkflowRunFlowFromVersion = ({
  currentState,
  nextTrigger,
  nextSteps,
}: MergeWorkflowRunFlowFromVersionInput): MergeWorkflowRunFlowFromVersionResult => {
  const oldSteps = currentState.flow.steps;
  const oldStepInfos = currentState.stepInfos ?? {};

  const oldStepByName = new Map(
    oldSteps.map((step) => [normalizeStepName(step.name), step]),
  );
  const newStepByName = new Map(
    nextSteps.map((step) => [normalizeStepName(step.name), step]),
  );

  const oldStepIdToNewStepId = buildOldStepIdToNewStepIdMap({
    oldSteps,
    newSteps: nextSteps,
  });

  const contentChangedStepNames = findContentChangedStepNames({
    oldSteps,
    newSteps: nextSteps,
  });

  const resetStepIds = collectStepIdsToReset({
    contentChangedStepNames,
    newStepByName,
    oldStepByName,
    oldStepInfos,
    nextSteps,
  });

  const nextStepInfos: Record<string, WorkflowRunStepInfo> = {
    trigger: oldStepInfos.trigger ?? { status: StepStatus.NOT_STARTED },
  };

  for (const nextStep of nextSteps) {
    const stepName = normalizeStepName(nextStep.name);
    const oldStep = oldStepByName.get(stepName);
    const oldStepId = oldStep?.id;
    const previousStepInfo = isDefined(oldStepId)
      ? oldStepInfos[oldStepId]
      : undefined;

    if (resetStepIds.has(nextStep.id)) {
      nextStepInfos[nextStep.id] = { status: StepStatus.NOT_STARTED };
      continue;
    }

    if (!isDefined(previousStepInfo)) {
      nextStepInfos[nextStep.id] = { status: StepStatus.NOT_STARTED };
      continue;
    }

    nextStepInfos[nextStep.id] = remapPendingStepIdReferences({
      stepInfo: previousStepInfo,
      oldStepIdToNewStepId,
    });
  }

  return {
    state: {
      ...currentState,
      flow: {
        trigger: nextTrigger,
        steps: nextSteps,
      },
      stepInfos: nextStepInfos,
    },
    upgraded: true,
    resetStepIds: [...resetStepIds],
  };
};

const normalizeStepName = (name: string): string => name.trim().toLowerCase();

const buildOldStepIdToNewStepIdMap = ({
  oldSteps,
  newSteps,
}: {
  oldSteps: WorkflowAction[];
  newSteps: WorkflowAction[];
}): Map<string, string> => {
  const newStepIdByName = new Map(
    newSteps.map((step) => [normalizeStepName(step.name), step.id]),
  );

  return oldSteps.reduce<Map<string, string>>((accumulator, oldStep) => {
    const nextStepId = newStepIdByName.get(normalizeStepName(oldStep.name));

    if (isDefined(nextStepId)) {
      accumulator.set(oldStep.id, nextStepId);
    }

    return accumulator;
  }, new Map());
};

const findContentChangedStepNames = ({
  oldSteps,
  newSteps,
}: {
  oldSteps: WorkflowAction[];
  newSteps: WorkflowAction[];
}): Set<string> => {
  const oldStepByName = new Map(
    oldSteps.map((step) => [normalizeStepName(step.name), step]),
  );

  return newSteps.reduce<Set<string>>((accumulator, nextStep) => {
    const stepName = normalizeStepName(nextStep.name);
    const oldStep = oldStepByName.get(stepName);

    if (!isDefined(oldStep)) {
      return accumulator;
    }

    if (!CONTENT_BEARING_ACTION_TYPES.has(nextStep.type)) {
      return accumulator;
    }

    if (
      getStepContentFingerprint(oldStep) !==
      getStepContentFingerprint(nextStep)
    ) {
      accumulator.add(stepName);
    }

    return accumulator;
  }, new Set());
};

const collectStepIdsToReset = ({
  contentChangedStepNames,
  newStepByName,
  oldStepByName,
  oldStepInfos,
  nextSteps,
}: {
  contentChangedStepNames: Set<string>;
  newStepByName: Map<string, WorkflowAction>;
  oldStepByName: Map<string, WorkflowAction>;
  oldStepInfos: Record<string, WorkflowRunStepInfo>;
  nextSteps: WorkflowAction[];
}): Set<string> => {
  const resetStepIds = new Set<string>();
  const nextStepById = new Map(nextSteps.map((step) => [step.id, step]));

  for (const stepName of contentChangedStepNames) {
    const nextStep = newStepByName.get(stepName);
    const oldStep = oldStepByName.get(stepName);

    if (!isDefined(nextStep) || !isDefined(oldStep)) {
      continue;
    }

    const previousStepInfo = oldStepInfos[oldStep.id];

    if (!isDefined(previousStepInfo)) {
      continue;
    }

    if (
      shouldResetStepOnContentChange({
        previousStatus: previousStepInfo.status,
        stepType: nextStep.type,
      })
    ) {
      resetStepIds.add(nextStep.id);
    }
  }

  const queue = [...resetStepIds];

  while (queue.length > 0) {
    const currentStepId = queue.shift();

    if (!isDefined(currentStepId)) {
      continue;
    }

    const currentStep = nextStepById.get(currentStepId);

    if (!isDefined(currentStep?.nextStepIds)) {
      continue;
    }

    for (const nextStepId of currentStep.nextStepIds) {
      if (resetStepIds.has(nextStepId)) {
        continue;
      }

      const nextStep = nextStepById.get(nextStepId);
      const stepName = isDefined(nextStep)
        ? normalizeStepName(nextStep.name)
        : undefined;
      const oldStep = isDefined(stepName)
        ? oldStepByName.get(stepName)
        : undefined;
      const previousStepInfo = isDefined(oldStep)
        ? oldStepInfos[oldStep.id]
        : undefined;

      if (
        isDefined(nextStep) &&
        isDefined(previousStepInfo) &&
        SEND_ACTION_TYPES.has(nextStep.type) &&
        previousStepInfo.status === StepStatus.SUCCESS
      ) {
        continue;
      }

      resetStepIds.add(nextStepId);
      queue.push(nextStepId);
    }
  }

  return resetStepIds;
};

const shouldResetStepOnContentChange = ({
  previousStatus,
  stepType,
}: {
  previousStatus: StepStatus;
  stepType: WorkflowActionType;
}): boolean => {
  if (
    previousStatus === StepStatus.SUCCESS &&
    SEND_ACTION_TYPES.has(stepType)
  ) {
    return false;
  }

  if (
    previousStatus === StepStatus.SUCCESS &&
    (stepType === WorkflowActionType.AI_AGENT ||
      stepType === WorkflowActionType.FORM)
  ) {
    return true;
  }

  return (
    previousStatus === StepStatus.PENDING ||
    previousStatus === StepStatus.RUNNING
  );
};

const getStepContentFingerprint = (step: WorkflowAction): string => {
  return JSON.stringify(step.settings?.input ?? {});
};

const remapPendingStepIdReferences = ({
  stepInfo,
  oldStepIdToNewStepId,
}: {
  stepInfo: WorkflowRunStepInfo;
  oldStepIdToNewStepId: Map<string, string>;
}): WorkflowRunStepInfo => {
  if (stepInfo.status !== StepStatus.PENDING) {
    return stepInfo;
  }

  return {
    ...stepInfo,
    pendingReason: remapStepIdReferencesInString(
      stepInfo.pendingReason,
      oldStepIdToNewStepId,
    ),
  };
};

const remapStepIdReferencesInString = (
  value: string | undefined,
  oldStepIdToNewStepId: Map<string, string>,
): string | undefined => {
  if (!isDefined(value)) {
    return value;
  }

  return value.replace(
    /\{\{([0-9a-f-]{36})([^}]*)\}\}/gi,
    (_match, stepId: string, suffix: string) => {
      const nextStepId = oldStepIdToNewStepId.get(stepId) ?? stepId;

      return `{{${nextStepId}${suffix}}}`;
    },
  );
};
