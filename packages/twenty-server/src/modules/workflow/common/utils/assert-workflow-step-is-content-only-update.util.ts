import { msg } from '@lingui/core/macro';
import {
  getStepOutgoingStepIds,
  WorkflowActionType,
} from 'twenty-shared/workflow';

import {
  WorkflowQueryValidationException,
  WorkflowQueryValidationExceptionCode,
} from 'src/modules/workflow/common/exceptions/workflow-query-validation.exception';
import { areStringArraysEqual } from 'src/modules/workflow/common/utils/are-string-arrays-equal.util';
import { isWorkflowIfElseAction } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/guards/is-workflow-if-else-action.guard';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { type WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

const getIfElseBranchTopologyKey = (step: WorkflowAction): string => {
  if (!isWorkflowIfElseAction(step)) {
    return '';
  }

  const branches = step.settings.input.branches ?? [];

  return JSON.stringify(
    branches.map((branch) => ({
      id: branch.id,
      filterGroupId: branch.filterGroupId ?? null,
      nextStepIds: [...(branch.nextStepIds ?? [])].sort(),
    })),
  );
};

export const assertWorkflowStepIsContentOnlyUpdate = ({
  existingStep,
  updatedStep,
}: {
  existingStep: WorkflowAction;
  updatedStep: WorkflowAction;
}) => {
  if (existingStep.type !== updatedStep.type) {
    throw new WorkflowQueryValidationException(
      'Changing step type on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }

  if (
    !areStringArraysEqual(existingStep.nextStepIds, updatedStep.nextStepIds)
  ) {
    throw new WorkflowQueryValidationException(
      'Changing step edges on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }

  if (
    !areStringArraysEqual(
      getStepOutgoingStepIds(existingStep),
      getStepOutgoingStepIds(updatedStep),
    )
  ) {
    throw new WorkflowQueryValidationException(
      'Changing step edges on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }

  if (
    getIfElseBranchTopologyKey(existingStep) !==
    getIfElseBranchTopologyKey(updatedStep)
  ) {
    throw new WorkflowQueryValidationException(
      'Changing if/else branches on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }
};

export const assertWorkflowTriggerIsContentOnlyUpdate = ({
  existingTrigger,
  updatedTrigger,
}: {
  existingTrigger: WorkflowTrigger;
  updatedTrigger: WorkflowTrigger;
}) => {
  if (existingTrigger.type !== updatedTrigger.type) {
    throw new WorkflowQueryValidationException(
      'Changing trigger type on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }

  if (
    !areStringArraysEqual(
      existingTrigger.nextStepIds,
      updatedTrigger.nextStepIds,
    )
  ) {
    throw new WorkflowQueryValidationException(
      'Changing trigger edges on a published workflow version requires a draft',
      WorkflowQueryValidationExceptionCode.FORBIDDEN,
      {
        userFriendlyMessage: msg`Changing the graph of a published workflow requires a draft`,
      },
    );
  }
};
