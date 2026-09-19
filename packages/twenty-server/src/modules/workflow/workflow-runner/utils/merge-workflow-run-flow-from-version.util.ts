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

type StepIndex = {
  byId: Map<string, WorkflowAction>;
  uniqueByName: Map<string, WorkflowAction>;
};

export const mergeWorkflowRunFlowFromVersion = ({
  currentState,
  nextTrigger,
  nextSteps,
}: MergeWorkflowRunFlowFromVersionInput): MergeWorkflowRunFlowFromVersionResult => {
  const oldSteps = currentState.flow.steps;
  const oldStepInfos = currentState.stepInfos ?? {};
  const oldStepIndex = buildStepIndex(oldSteps);
  const newStepIndex = buildStepIndex(nextSteps);

  const oldStepIdToNewStepId = buildOldStepIdToNewStepIdMap({
    oldSteps,
    newStepIndex,
  });

  const contentChangedStepIds = findContentChangedStepIds({
    oldStepIndex,
    newSteps: nextSteps,
  });

  const resetStepIds = collectStepIdsToReset({
    contentChangedStepIds,
    oldStepIndex,
    oldStepInfos,
    nextSteps,
  });

  const nextStepInfos: Record<string, WorkflowRunStepInfo> = {
    trigger: oldStepInfos.trigger ?? { status: StepStatus.NOT_STARTED },
  };

  for (const nextStep of nextSteps) {
    const oldStep = resolveCorrespondingOldStep({
      nextStep,
      oldStepIndex,
    });
    const previousStepInfo = isDefined(oldStep)
      ? oldStepInfos[oldStep.id]
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

// Prefer stable step ids. Fall back to name only when that name is unique in
// the graph — duplicate names (e.g. three "Load Candidate") must not collide.
const buildStepIndex = (steps: WorkflowAction[]): StepIndex => {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const countsByName = new Map<string, number>();

  for (const step of steps) {
    const stepName = normalizeStepName(step.name);
    countsByName.set(stepName, (countsByName.get(stepName) ?? 0) + 1);
  }

  const uniqueByName = new Map<string, WorkflowAction>();

  for (const step of steps) {
    const stepName = normalizeStepName(step.name);

    if (countsByName.get(stepName) === 1) {
      uniqueByName.set(stepName, step);
    }
  }

  return { byId, uniqueByName };
};

const resolveCorrespondingOldStep = ({
  nextStep,
  oldStepIndex,
}: {
  nextStep: WorkflowAction;
  oldStepIndex: StepIndex;
}): WorkflowAction | undefined => {
  const byId = oldStepIndex.byId.get(nextStep.id);

  if (isDefined(byId)) {
    return byId;
  }

  return oldStepIndex.uniqueByName.get(normalizeStepName(nextStep.name));
};

const buildOldStepIdToNewStepIdMap = ({
  oldSteps,
  newStepIndex,
}: {
  oldSteps: WorkflowAction[];
  newStepIndex: StepIndex;
}): Map<string, string> => {
  return oldSteps.reduce<Map<string, string>>((accumulator, oldStep) => {
    const nextStepById = newStepIndex.byId.get(oldStep.id);

    if (isDefined(nextStepById)) {
      accumulator.set(oldStep.id, nextStepById.id);

      return accumulator;
    }

    const nextStepByName = newStepIndex.uniqueByName.get(
      normalizeStepName(oldStep.name),
    );

    if (isDefined(nextStepByName)) {
      accumulator.set(oldStep.id, nextStepByName.id);
    }

    return accumulator;
  }, new Map());
};

const findContentChangedStepIds = ({
  oldStepIndex,
  newSteps,
}: {
  oldStepIndex: StepIndex;
  newSteps: WorkflowAction[];
}): Set<string> => {
  return newSteps.reduce<Set<string>>((accumulator, nextStep) => {
    const oldStep = resolveCorrespondingOldStep({
      nextStep,
      oldStepIndex,
    });

    if (!isDefined(oldStep)) {
      return accumulator;
    }

    if (!CONTENT_BEARING_ACTION_TYPES.has(nextStep.type)) {
      return accumulator;
    }

    if (
      getStepContentFingerprint(oldStep) !== getStepContentFingerprint(nextStep)
    ) {
      accumulator.add(nextStep.id);
    }

    return accumulator;
  }, new Set());
};

const collectStepIdsToReset = ({
  contentChangedStepIds,
  oldStepIndex,
  oldStepInfos,
  nextSteps,
}: {
  contentChangedStepIds: Set<string>;
  oldStepIndex: StepIndex;
  oldStepInfos: Record<string, WorkflowRunStepInfo>;
  nextSteps: WorkflowAction[];
}): Set<string> => {
  const resetStepIds = new Set<string>();
  const nextStepById = new Map(nextSteps.map((step) => [step.id, step]));

  for (const nextStepId of contentChangedStepIds) {
    const nextStep = nextStepById.get(nextStepId);

    if (!isDefined(nextStep)) {
      continue;
    }

    const oldStep = resolveCorrespondingOldStep({
      nextStep,
      oldStepIndex,
    });
    const previousStepInfo = isDefined(oldStep)
      ? oldStepInfos[oldStep.id]
      : undefined;

    if (!isDefined(previousStepInfo)) {
      continue;
    }

    if (
      !shouldResetStepOnContentChange({
        previousStatus: previousStepInfo.status,
        stepType: nextStep.type,
      })
    ) {
      continue;
    }

    // Do not reopen draft/approve after a downstream send already succeeded —
    // resetting FORM while preserving SEND SUCCESS yields Approve PENDING +
    // Send SUCCESS (Abdullah-style corrupted diagram).
    if (
      hasSuccessfulDownstreamSend({
        startStepId: nextStep.id,
        nextStepById,
        oldStepIndex,
        oldStepInfos,
      })
    ) {
      continue;
    }

    resetStepIds.add(nextStep.id);
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
      const oldStep = isDefined(nextStep)
        ? resolveCorrespondingOldStep({ nextStep, oldStepIndex })
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

const hasSuccessfulDownstreamSend = ({
  startStepId,
  nextStepById,
  oldStepIndex,
  oldStepInfos,
}: {
  startStepId: string;
  nextStepById: Map<string, WorkflowAction>;
  oldStepIndex: StepIndex;
  oldStepInfos: Record<string, WorkflowRunStepInfo>;
}): boolean => {
  const visitedStepIds = new Set<string>();
  const queue = [startStepId];

  while (queue.length > 0) {
    const currentStepId = queue.shift();

    if (!isDefined(currentStepId) || visitedStepIds.has(currentStepId)) {
      continue;
    }

    visitedStepIds.add(currentStepId);

    const currentStep = nextStepById.get(currentStepId);

    if (!isDefined(currentStep?.nextStepIds)) {
      continue;
    }

    for (const nextStepId of currentStep.nextStepIds) {
      const nextStep = nextStepById.get(nextStepId);

      if (!isDefined(nextStep)) {
        continue;
      }

      const oldStep = resolveCorrespondingOldStep({
        nextStep,
        oldStepIndex,
      });
      const previousStepInfo = isDefined(oldStep)
        ? oldStepInfos[oldStep.id]
        : undefined;

      if (
        SEND_ACTION_TYPES.has(nextStep.type) &&
        previousStepInfo?.status === StepStatus.SUCCESS
      ) {
        return true;
      }

      queue.push(nextStepId);
    }
  }

  return false;
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
