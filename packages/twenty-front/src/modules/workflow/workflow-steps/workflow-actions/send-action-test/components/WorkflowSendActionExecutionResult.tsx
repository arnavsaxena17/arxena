import {
  type ExecutionStatus,
  WorkflowStepExecutionResult,
} from '@/workflow/components/WorkflowStepExecutionResult';
import { type WorkflowSendActionTestData } from '@/workflow/workflow-steps/workflow-actions/send-action-test/types/WorkflowSendActionTestData';
import { t } from '@lingui/core/macro';

export const WorkflowSendActionExecutionResult = ({
  sendActionTestData,
  isTesting = false,
}: {
  sendActionTestData: WorkflowSendActionTestData;
  isTesting?: boolean;
}) => {
  const result =
    sendActionTestData.output.data || sendActionTestData.output.error || '';
  const isError = sendActionTestData.output.error !== undefined;
  const isSuccess =
    sendActionTestData.output.data !== undefined &&
    sendActionTestData.output.error === undefined &&
    sendActionTestData.output.duration !== undefined;

  const durationLabel = sendActionTestData.output.duration
    ? `${sendActionTestData.output.duration}ms`
    : undefined;

  const status: ExecutionStatus = {
    isSuccess,
    isError,
    successMessage: durationLabel,
    errorMessage: t`Send test failed`,
    additionalInfo: isError ? t`An error occurred` : undefined,
  };

  return (
    <WorkflowStepExecutionResult
      result={result}
      language={sendActionTestData.language}
      height="100%"
      status={status}
      isTesting={isTesting}
      loadingMessage={t`Sending...`}
      idleMessage={t`Result`}
    />
  );
};
