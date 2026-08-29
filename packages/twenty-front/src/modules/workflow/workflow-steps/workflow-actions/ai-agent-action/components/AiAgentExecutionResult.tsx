import {
  type ExecutionStatus,
  WorkflowStepExecutionResult,
} from '@/workflow/components/WorkflowStepExecutionResult';
import { type AiAgentTestData } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/types/AiAgentTestData';
import { t } from '@lingui/core/macro';

export const AiAgentExecutionResult = ({
  aiAgentTestData,
  isTesting = false,
}: {
  aiAgentTestData: AiAgentTestData;
  isTesting?: boolean;
}) => {
  const result =
    aiAgentTestData.output.data || aiAgentTestData.output.error || '';
  const isError = aiAgentTestData.output.error !== undefined;
  const isSuccess =
    aiAgentTestData.output.data !== undefined &&
    aiAgentTestData.output.error === undefined &&
    aiAgentTestData.output.duration !== undefined;

  const durationLabel = aiAgentTestData.output.duration
    ? `${aiAgentTestData.output.duration}ms`
    : undefined;

  const status: ExecutionStatus = {
    isSuccess,
    isError,
    successMessage: durationLabel,
    errorMessage: t`Agent test failed`,
    additionalInfo: isError ? t`An error occurred` : undefined,
  };

  return (
    <WorkflowStepExecutionResult
      result={result}
      language={aiAgentTestData.language}
      height="100%"
      status={status}
      isTesting={isTesting}
      loadingMessage={t`Running agent...`}
      idleMessage={t`Result`}
    />
  );
};
