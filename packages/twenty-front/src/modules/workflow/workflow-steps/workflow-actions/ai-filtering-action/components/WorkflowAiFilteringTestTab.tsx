import { type AiFilteringTestData } from '@/workflow/workflow-steps/workflow-actions/ai-filtering-action/hooks/useTestWorkflowAiFiltering';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { Callout } from 'twenty-ui/feedback';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES } from 'twenty-shared/workflow';

type WorkflowAiFilteringTestTabProps = {
  isTesting: boolean;
  testData: AiFilteringTestData;
  canTest: boolean;
  jevHint: string | null;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledPre = styled.pre`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  max-height: 420px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
`;

export const WorkflowAiFilteringTestTab = ({
  isTesting,
  testData,
  canTest,
  jevHint,
}: WorkflowAiFilteringTestTabProps) => {
  const { t } = useLingui();

  return (
    <StyledContainer>
      <Callout
        variant="warning"
        Icon={IconAlertTriangle}
        title={t`Sample run (sync)`}
        description={t`Runs the configured prompt on a fixed sample of 2 candidates using TypeSafe Jev by default. Does not write CRM fields or enqueue a workflow run.`}
      />

      {jevHint && (
        <Callout
          variant="danger"
          Icon={IconAlertTriangle}
          title={t`Cannot run with Jev`}
          description={jevHint}
        />
      )}

      <StyledPre>
        {JSON.stringify(WORKFLOW_AI_FILTERING_SAMPLE_CANDIDATES, null, 2)}
      </StyledPre>

      {(isTesting || testData.message) && (
        <StyledPre>
          {isTesting
            ? t`Running…`
            : JSON.stringify(
                {
                  success: testData.success,
                  message: testData.message,
                  durationMs: testData.durationMs,
                  result: testData.result,
                  error: testData.error,
                },
                null,
                2,
              )}
        </StyledPre>
      )}

      {!canTest && !jevHint && (
        <Callout
          variant="warning"
          Icon={IconAlertTriangle}
          title={t`Fill configure tab first`}
          description={t`Add a prompt and at least one structured output field before testing.`}
        />
      )}
    </StyledContainer>
  );
};
