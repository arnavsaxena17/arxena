import {
  type ExecutionStatus,
  WorkflowStepExecutionResult,
} from '@/workflow/components/WorkflowStepExecutionResult';
import { type WorkflowFormNotifyTestData } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormNotifyTestData';
import { t } from '@lingui/core/macro';

export const WorkflowFormNotifyTestResult = ({
  testData,
  isTesting = false,
}: {
  testData: WorkflowFormNotifyTestData;
  isTesting?: boolean;
}) => {
  const output = testData.output;
  const statusValue = output.status;

  const result = JSON.stringify(
    {
      status: statusValue,
      fillUrl: output.fillUrl,
      sendResults: output.sendResults,
      capturedResponse: output.capturedResponse,
      error: output.error,
      pointer: output.pointer,
    },
    null,
    2,
  );

  const isCaptured = statusValue === 'captured';
  const isWaiting = statusValue === 'waiting';
  const isError =
    statusValue === 'failed' ||
    statusValue === 'expired';

  const successMessage = isCaptured
    ? t`WhatsApp reply captured`
    : isWaiting
      ? t`Waiting for WhatsApp / form reply`
      : undefined;

  const status: ExecutionStatus = {
    isSuccess: isCaptured || isWaiting,
    isError,
    successMessage: output.duration
      ? `${successMessage} - ${output.duration}ms`
      : successMessage,
    errorMessage: output.error ?? t`Form WhatsApp test failed`,
    additionalInfo: isWaiting
      ? output.error ?? t`Reply on WhatsApp or open the fill URL`
      : undefined,
  };

  return (
    <WorkflowStepExecutionResult
      result={
        statusValue || output.error
          ? result
          : ''
      }
      language="json"
      height="100%"
      status={status}
      isTesting={isTesting}
      loadingMessage={t`Sending WhatsApp...`}
      idleMessage={t`Press Test to send a real WhatsApp ping`}
    />
  );
};
