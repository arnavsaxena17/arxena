import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { WorkflowRunRateLimitSnackBarEffect } from '@/workflow/components/WorkflowRunRateLimitSnackBarEffect';
import { useWorkflowRun } from '@/workflow/hooks/useWorkflowRun';
import { WorkflowRunDiagramCanvas } from '@/workflow/workflow-diagram/components/WorkflowRunDiagramCanvas';
import { workflowDiagramStatusComponentState } from '@/workflow/workflow-diagram/states/workflowDiagramStatusComponentState';
import { styled } from '@linaria/react';
import { isDefined, isNonEmptyString } from 'twenty-shared/utils';
import { StepStatus } from 'twenty-shared/workflow';
import { IconAlertTriangle } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRunErrorBanner = styled.div`
  align-items: flex-start;
  background: ${themeCssVariables.background.danger};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.danger};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  left: ${themeCssVariables.spacing[4]};
  max-width: min(480px, calc(100% - ${themeCssVariables.spacing[8]}));
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  pointer-events: none;
  position: absolute;
  right: ${themeCssVariables.spacing[4]};
  top: ${themeCssVariables.spacing[12]};
  z-index: 5;
`;

const StyledRunErrorMessage = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledVisualizerContainer = styled.div`
  height: 100%;
  position: relative;
  width: 100%;
`;

const hasStepLevelError = (
  stepInfos:
    | Record<string, { status?: StepStatus; error?: string }>
    | undefined,
): boolean => {
  if (!isDefined(stepInfos)) {
    return false;
  }

  return Object.values(stepInfos).some(
    (stepInfo) =>
      stepInfo.status === StepStatus.FAILED || isNonEmptyString(stepInfo.error),
  );
};

export const WorkflowRunVisualizer = ({
  workflowRunId,
}: {
  workflowRunId: string;
}) => {
  const workflowRun = useWorkflowRun({ workflowRunId });
  const workflowDiagramStatus = useAtomComponentStateValue(
    workflowDiagramStatusComponentState,
  );

  const workflowRunError = workflowRun?.state?.workflowRunError;
  const shouldShowRunErrorBanner =
    workflowRun?.status === 'FAILED' &&
    isNonEmptyString(workflowRunError) &&
    !hasStepLevelError(workflowRun.state?.stepInfos);

  return (
    <StyledVisualizerContainer>
      <WorkflowRunRateLimitSnackBarEffect workflowRunId={workflowRunId} />
      {shouldShowRunErrorBanner ? (
        <StyledRunErrorBanner>
          <IconAlertTriangle size={16} />
          <StyledRunErrorMessage>{workflowRunError}</StyledRunErrorMessage>
        </StyledRunErrorBanner>
      ) : null}
      {isDefined(workflowRun) &&
        workflowDiagramStatus !== 'computing-diagram' && (
          <WorkflowRunDiagramCanvas workflowRunStatus={workflowRun.status} />
        )}
    </StyledVisualizerContainer>
  );
};
