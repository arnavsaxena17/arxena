import { useWorkflowRun } from '@/workflow/hooks/useWorkflowRun';
import { useWorkflowRunIdOrThrow } from '@/workflow/hooks/useWorkflowRunIdOrThrow';
import { getStepDefinitionOrThrow } from '@/workflow/utils/getStepDefinitionOrThrow';
import { WorkflowJsonViewSwitcher } from '@/workflow/workflow-steps/components/WorkflowJsonViewSwitcher';
import { WorkflowRunStepJsonContainer } from '@/workflow/workflow-steps/components/WorkflowRunStepJsonContainer';
import { useWorkflowRunStepInfo } from '@/workflow/workflow-steps/hooks/useWorkflowRunStepInfo';
import { getWorkflowRunStepInfoToDisplayAsOutput } from '@/workflow/workflow-steps/utils/getWorkflowRunStepInfoToDisplayAsOutput';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { type GetJsonNodeHighlighting } from 'twenty-ui/json-visualizer';
import { type JsonValue } from 'type-fest';

export const WorkflowRunStepOutputDetail = ({ stepId }: { stepId: string }) => {
  const { t } = useLingui();

  const workflowRunId = useWorkflowRunIdOrThrow();
  const workflowRun = useWorkflowRun({ workflowRunId });

  const stepInfo = useWorkflowRunStepInfo({ stepId });

  if (!isDefined(workflowRun?.state) || !isDefined(stepInfo)) {
    return null;
  }

  const stepInfoToDisplay = getWorkflowRunStepInfoToDisplayAsOutput({
    stepInfo,
  });

  const stepDefinition = getStepDefinitionOrThrow({
    stepId,
    trigger: workflowRun.state.flow.trigger,
    steps: workflowRun.state.flow.steps,
  });
  if (!isDefined(stepDefinition?.definition)) {
    throw new Error('The step is expected to be properly shaped.');
  }

  const setRedHighlightingForEveryNode: GetJsonNodeHighlighting = (keyPath) => {
    if (keyPath.startsWith('error')) {
      return 'red';
    }

    return undefined;
  };

  return (
    <WorkflowRunStepJsonContainer>
      <WorkflowJsonViewSwitcher
        value={(stepInfoToDisplay as JsonValue) ?? t`No output available`}
        getNodeHighlighting={
          isDefined(stepInfo?.error)
            ? setRedHighlightingForEveryNode
            : undefined
        }
      />
    </WorkflowRunStepJsonContainer>
  );
};
