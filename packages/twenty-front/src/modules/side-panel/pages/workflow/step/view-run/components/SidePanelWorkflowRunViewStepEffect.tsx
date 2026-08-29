import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useWorkflowRun } from '@/workflow/hooks/useWorkflowRun';
import { useWorkflowVersion } from '@/workflow/hooks/useWorkflowVersion';
import { flowComponentState } from '@/workflow/states/flowComponentState';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { workflowVisualizerWorkflowRunIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowRunIdComponentState';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { useStepsOutputSchema } from '@/workflow/workflow-variables/hooks/useStepsOutputSchema';
import { useEffect } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const SidePanelWorkflowRunViewStepEffect = ({
  workflowRunId,
}: {
  workflowRunId: string;
}) => {
  const workflowRun = useWorkflowRun({ workflowRunId });
  const workflowVersion = useWorkflowVersion(workflowRun?.workflowVersionId);
  const { populateStepsOutputSchema } = useStepsOutputSchema();

  const setWorkflowVisualizerWorkflowRunId = useSetAtomComponentState(
    workflowVisualizerWorkflowRunIdComponentState,
  );
  const setWorkflowVisualizerWorkflowId = useSetAtomComponentState(
    workflowVisualizerWorkflowIdComponentState,
  );
  const setWorkflowVisualizerWorkflowVersionId = useSetAtomComponentState(
    workflowVisualizerWorkflowVersionIdComponentState,
  );
  const setFlow = useSetAtomComponentState(flowComponentState);

  useEffect(() => {
    setWorkflowVisualizerWorkflowRunId(workflowRunId);
  }, [setWorkflowVisualizerWorkflowRunId, workflowRunId]);

  useEffect(() => {
    if (!isDefined(workflowRun)) {
      return;
    }

    setWorkflowVisualizerWorkflowId(workflowRun.workflowId);
    setWorkflowVisualizerWorkflowVersionId(workflowRun.workflowVersionId);

    if (!isDefined(workflowRun.state)) {
      return;
    }

    setFlow({
      workflowVersionId: workflowRun.workflowVersionId,
      trigger: workflowRun.state.flow.trigger,
      steps: workflowRun.state.flow.steps,
    });
  }, [
    setFlow,
    setWorkflowVisualizerWorkflowId,
    setWorkflowVisualizerWorkflowVersionId,
    workflowRun,
  ]);

  useEffect(() => {
    if (!isDefined(workflowVersion)) {
      return;
    }

    populateStepsOutputSchema(workflowVersion);
  }, [populateStepsOutputSchema, workflowVersion]);

  return null;
};
