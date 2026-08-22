import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { WorkflowRunRateLimitSnackBarEffect } from '@/workflow/components/WorkflowRunRateLimitSnackBarEffect';
import { useWorkflowRun } from '@/workflow/hooks/useWorkflowRun';
import { WorkflowRunDiagramCanvas } from '@/workflow/workflow-diagram/components/WorkflowRunDiagramCanvas';
import { workflowDiagramStatusComponentState } from '@/workflow/workflow-diagram/states/workflowDiagramStatusComponentState';
import { isDefined } from 'twenty-shared/utils';

export const WorkflowRunVisualizer = ({
  workflowRunId,
}: {
  workflowRunId: string;
}) => {
  const workflowRun = useWorkflowRun({ workflowRunId });
  const workflowDiagramStatus = useAtomComponentStateValue(
    workflowDiagramStatusComponentState,
  );

  return (
    <>
      <WorkflowRunRateLimitSnackBarEffect workflowRunId={workflowRunId} />
      {isDefined(workflowRun) &&
        workflowDiagramStatus !== 'computing-diagram' && (
          <WorkflowRunDiagramCanvas workflowRunStatus={workflowRun.status} />
        )}
    </>
  );
};
