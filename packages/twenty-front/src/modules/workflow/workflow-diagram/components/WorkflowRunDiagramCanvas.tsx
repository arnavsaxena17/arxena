import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { type WorkflowRunStatus } from '@/workflow/types/Workflow';
import { WorkflowDiagramCanvasBase } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasBase';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';

import { getWorkflowRunStatusTagProps } from '@/workflow/workflow-diagram/utils/getWorkflowRunStatusTagProps';
import { WorkflowDiagramDefaultEdgeReadonly } from '@/workflow/workflow-diagram/workflow-edges/components/WorkflowDiagramDefaultEdgeReadonly';
import { WorkflowRunDiagramStepNode } from '@/workflow/workflow-diagram/workflow-nodes/components/WorkflowRunDiagramStepNode';
import { ReactFlowProvider } from '@xyflow/react';

export const WorkflowRunDiagramCanvas = ({
  workflowRunStatus,
}: {
  workflowRunStatus: WorkflowRunStatus;
}) => {
  const tagProps = getWorkflowRunStatusTagProps({
    workflowRunStatus,
  });

  const setWorkflowDiagramRightClickMenuPosition = useSetAtomComponentState(
    workflowDiagramRightClickMenuPositionState,
  );

  const handlePaneContextMenu = ({ x, y }: { x: number; y: number }) => {
    setWorkflowDiagramRightClickMenuPosition({
      x,
      y,
    });
  };

  return (
    <ReactFlowProvider>
      <WorkflowDiagramCanvasBase
        nodeTypes={{
          default: WorkflowRunDiagramStepNode,
        }}
        edgeTypes={{
          readonly: WorkflowDiagramDefaultEdgeReadonly,
        }}
        tagContainerTestId="workflow-run-status"
        tagColor={tagProps.color}
        tagText={tagProps.text}
        handlePaneContextMenu={handlePaneContextMenu}
        showAddNodeInContextMenu={false}
      />
    </ReactFlowProvider>
  );
};
