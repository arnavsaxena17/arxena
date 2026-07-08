import { CustomException } from 'src/utils/custom-exception';

export class WorkflowStepExecutorException extends CustomException {
  constructor(message: string, code: WorkflowStepExecutorExceptionCode) {
    super(message, code);
  }
}

export enum WorkflowStepExecutorExceptionCode {
  SCOPED_WORKSPACE_NOT_FOUND = 'SCOPED_WORKSPACE_NOT_FOUND',
  INVALID_STEP_TYPE = 'INVALID_STEP_TYPE',
  INVALID_STEP_INPUT = 'INVALID_STEP_INPUT',
  STEP_NOT_FOUND = 'STEP_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
