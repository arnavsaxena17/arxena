import { WorkflowVersionStatus } from '@/workflow/types/Workflow';
import { WorkflowBuilderActionButtons } from '@/workflow/components/WorkflowBuilderActionButtons';
import { WorkflowDiagramCanvasBase } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasBase';
import { WorkflowDiagramCanvasEditableEffect } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasEditableEffect';
import { WorkflowDiagramCreateStepNode } from '@/workflow/workflow-diagram/components/WorkflowDiagramCreateStepNode';
import { WorkflowDiagramDefaultEdge } from '@/workflow/workflow-diagram/components/WorkflowDiagramDefaultEdge';
import { WorkflowDiagramEmptyTrigger } from '@/workflow/workflow-diagram/components/WorkflowDiagramEmptyTrigger';
import { WorkflowDiagramRightClickCommandMenu } from '@/workflow/workflow-diagram/components/WorkflowDiagramRightClickCommandMenu';
import { WorkflowDiagramStepNodeEditable } from '@/workflow/workflow-diagram/components/WorkflowDiagramStepNodeEditable';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import { ReactFlowProvider } from '@xyflow/react';
import { useSetRecoilState } from 'recoil';

export const WorkflowDiagramCanvasEditable = ({
  versionStatus,
  workflowId,
  workflowVersionId,
}: {
  versionStatus: WorkflowVersionStatus;
  workflowId?: string;
  workflowVersionId?: string;
}) => {
  const setWorkflowDiagramRightClickMenuPosition = useSetRecoilState(
    workflowDiagramRightClickMenuPositionState,
  );

  const handlePaneContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();

    setWorkflowDiagramRightClickMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <ReactFlowProvider>
      <WorkflowDiagramCanvasBase
        status={versionStatus}
        toolbarContent={
          <WorkflowBuilderActionButtons
            workflowId={workflowId}
            workflowVersionId={workflowVersionId}
          />
        }
        onPaneContextMenu={handlePaneContextMenu}
        nodeTypes={{
          default: WorkflowDiagramStepNodeEditable,
          'create-step': WorkflowDiagramCreateStepNode,
          'empty-trigger': WorkflowDiagramEmptyTrigger,
        }}
        edgeTypes={{
          default: WorkflowDiagramDefaultEdge,
        }}
      />
      <WorkflowDiagramCanvasEditableEffect />
      <WorkflowDiagramRightClickCommandMenu />
    </ReactFlowProvider>
  );
};
