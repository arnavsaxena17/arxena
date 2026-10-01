import {
  type ExecutionStatus,
  WorkflowStepExecutionResult,
} from '@/workflow/components/WorkflowStepExecutionResult';
import { type AiAgentTestData } from '@/workflow/workflow-steps/workflow-actions/ai-agent-action/types/AiAgentTestData';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledValidation = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
`;

const formatFieldLine = (
  field: NonNullable<
    AiAgentTestData['output']['outputValidation']
  >['fields'][number],
): string => {
  if (field.skipped) {
    return `${field.fieldKey}: empty, skipped`;
  }

  const checkDetails = isDefined(field.checkResults)
    ? field.checkResults.map((checkResult) => {
        const score = isDefined(checkResult.noul)
          ? checkResult.noul.toFixed(2)
          : 'n/a';

        return `${checkResult.label} ${score}`;
      })
    : [
        isDefined(field.operatorNote)
          ? `operator note ${field.operatorNote.toFixed(2)}`
          : undefined,
        isDefined(field.unresolvedPlaceholder)
          ? `placeholder ${field.unresolvedPlaceholder.toFixed(2)}`
          : undefined,
      ].filter(isDefined);
  const details = [
    ...checkDetails,
    field.codeFailure ? `token ${field.codeFailure}` : undefined,
  ].filter(isDefined);

  const verdict = field.cleared ? 'cleared' : 'not cleared';
  const detailText = details.length > 0 ? ` (${details.join(', ')})` : '';

  return `${field.fieldKey}: ${verdict}${detailText}`;
};

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
  const outputValidation = aiAgentTestData.output.outputValidation;
  const durationLabel = aiAgentTestData.output.duration
    ? `${aiAgentTestData.output.duration}ms`
    : undefined;
  const attemptLabel = isDefined(outputValidation)
    ? outputValidation.attempts === 1
      ? t`1 draft`
      : t`${outputValidation.attempts} drafts`
    : undefined;

  const status: ExecutionStatus = {
    isSuccess,
    isError,
    successMessage: durationLabel,
    errorMessage: t`Agent test failed`,
    additionalInfo: attemptLabel,
  };

  return (
    <>
      {isDefined(outputValidation) ? (
        <StyledValidation>
          <div>
            {outputValidation.cleared
              ? t`Jev cleared this draft`
              : t`Jev did not clear this draft`}
          </div>
          {outputValidation.fields.map((field) => (
            <div key={field.fieldKey}>{formatFieldLine(field)}</div>
          ))}
        </StyledValidation>
      ) : null}
      <WorkflowStepExecutionResult
        result={result}
        language={aiAgentTestData.language}
        height="100%"
        status={status}
        isTesting={isTesting}
        loadingMessage={t`Running agent...`}
        idleMessage={t`Result`}
      />
    </>
  );
};
