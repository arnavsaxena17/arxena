import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const findStepOrThrow = ({
  stepId,
  steps,
}: {
  stepId: string;
  steps: WorkflowAction[];
}): WorkflowAction => {
  const step = steps.find((stepToExecute) => stepToExecute.id === stepId);

  if (!step) {
    throw new WorkflowStepExecutorException(
      `Step ${stepId} not found`,
      WorkflowStepExecutorExceptionCode.STEP_NOT_FOUND,
    );
  }

  return step;
};
