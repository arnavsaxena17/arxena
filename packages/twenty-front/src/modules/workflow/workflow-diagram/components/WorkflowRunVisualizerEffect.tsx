import { flowState } from '@/workflow/states/flowState';
import { WorkflowRun } from '@/workflow/types/Workflow';
import { workflowDiagramState } from '@/workflow/workflow-diagram/states/workflowDiagramState';
import { generateWorkflowRunDiagram } from '@/workflow/workflow-diagram/utils/generateWorkflowRunDiagram';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { isDefined } from 'twenty-shared';

export const WorkflowRunVisualizerEffect = ({
  workflowRun,
}: {
  workflowRun: WorkflowRun;
}) => {
  const setFlow = useSetRecoilState(flowState);
  const setWorkflowDiagram = useSetRecoilState(workflowDiagramState);

  const flow = workflowRun.state?.flow ?? workflowRun.output?.flow;

  useEffect(() => {
    if (!isDefined(flow)) {
      setFlow(undefined);

      return;
    }

    setFlow({
      trigger: flow.trigger,
      steps: flow.steps,
    });
  }, [setFlow, flow]);

  useEffect(() => {
    if (!isDefined(flow)) {
      setWorkflowDiagram(undefined);

      return;
    }

    const nextWorkflowDiagram = generateWorkflowRunDiagram({
      trigger: flow.trigger,
      steps: flow.steps,
      stepsOutput: workflowRun.output?.stepsOutput,
      stepInfos: workflowRun.state?.stepInfos,
    });

    setWorkflowDiagram(nextWorkflowDiagram);
  }, [setWorkflowDiagram, flow, workflowRun.output, workflowRun.state]);

  return null;
};
