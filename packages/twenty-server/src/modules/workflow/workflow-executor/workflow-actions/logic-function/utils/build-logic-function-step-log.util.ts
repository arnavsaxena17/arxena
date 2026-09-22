import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { type LogicFunctionExecuteResult } from 'src/engine/core-modules/logic-function/logic-function-drivers/interfaces/logic-function-driver.interface';
import { LogicFunctionExecutionStatus } from 'src/engine/metadata-modules/logic-function/dtos/logic-function-execution-result.dto';
import { buildCodeStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/code/utils/build-code-step-log.util';

const MAX_MESSAGE_LENGTH = 4_000;

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}…[truncated]` : value;

const appendStatusEntry = ({
  stepLog,
  logicFunctionName,
  errorMessage,
}: {
  stepLog: WorkflowRunStepLog;
  logicFunctionName: string;
  errorMessage?: string;
}): WorkflowRunStepLog => {
  const timestamp = new Date().toISOString();
  const statusEntry =
    typeof errorMessage === 'string' && errorMessage.length > 0
      ? {
          timestamp,
          level: 'error' as const,
          message: truncate(
            `${logicFunctionName} failed: ${errorMessage}`,
            MAX_MESSAGE_LENGTH,
          ),
        }
      : {
          timestamp,
          level: 'info' as const,
          message: truncate(
            `${logicFunctionName} completed successfully`,
            MAX_MESSAGE_LENGTH,
          ),
        };

  return {
    ...stepLog,
    entries: [statusEntry, ...stepLog.entries],
  };
};

export const buildLogicFunctionStepLogFromExecutorResult = ({
  logicFunctionName,
  result,
}: {
  logicFunctionName: string;
  result: LogicFunctionExecuteResult;
}): WorkflowRunStepLog =>
  appendStatusEntry({
    stepLog: buildCodeStepLog(result),
    logicFunctionName,
    errorMessage: result.error?.errorMessage,
  });

export const buildLogicFunctionStepLogFromNativeResult = ({
  logicFunctionName,
  durationMs,
  errorMessage,
  pending = false,
}: {
  logicFunctionName: string;
  durationMs: number;
  errorMessage?: string;
  pending?: boolean;
}): WorkflowRunStepLog => {
  const hasError = typeof errorMessage === 'string' && errorMessage.length > 0;

  const result: LogicFunctionExecuteResult = {
    data: null,
    duration: durationMs,
    logs: '',
    status: hasError
      ? LogicFunctionExecutionStatus.ERROR
      : LogicFunctionExecutionStatus.SUCCESS,
    ...(hasError
      ? {
          error: {
            errorType: 'NativeLogicFunctionError',
            errorMessage,
            stackTrace: '',
          },
        }
      : {}),
  };

  const stepLog = appendStatusEntry({
    stepLog: buildCodeStepLog(result),
    logicFunctionName,
    errorMessage,
  });

  if (!pending) {
    return stepLog;
  }

  return {
    ...stepLog,
    entries: [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: truncate(
          `${logicFunctionName} is waiting for an external event`,
          MAX_MESSAGE_LENGTH,
        ),
      },
      ...stepLog.entries,
    ],
  };
};
