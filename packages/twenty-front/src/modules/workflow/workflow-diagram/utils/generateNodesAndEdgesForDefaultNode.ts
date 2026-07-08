import { WorkflowStep } from '@/workflow/types/Workflow';
import { WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeDefaultConfiguration';
import { WorkflowContext } from '@/workflow/workflow-diagram/types/WorkflowContext';
import {
  WorkflowDiagramEdge,
  WorkflowDiagramNode,
  WorkflowDiagramStepNodeData,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { getEdgeTypeBetweenTwoNodes } from '@/workflow/workflow-diagram/utils/getEdgeTypeBetweenTwoNodes';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultSourceHandleId';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultTargetHandleId';
import { isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

export const generateNodesAndEdgesForDefaultNode = ({
  step,
  nextStepIds,
  steps,
  xPos,
  yPos,
  nodes,
  edges,
  workflowContext,
}: {
  step: WorkflowStep;
  nextStepIds: string[];
  steps: WorkflowStep[];
  xPos: number;
  yPos: number;
  nodes: readonly WorkflowDiagramNode[];
  edges: readonly WorkflowDiagramEdge[];
  workflowContext: WorkflowContext;
}): {
  nodes: Array<WorkflowDiagramNode>;
  edges: Array<WorkflowDiagramEdge>;
} => {
  const edgeType = getEdgeTypeBetweenTwoNodes({ workflowContext });

  const updatedNodes = [...nodes];
  const updatedEdges = [...edges];

  updatedNodes.push({
    id: step.id,
    data: {
      nodeType: 'action',
      actionType: step.type,
      name: step.name,
      isLeafNode: false,
    } satisfies WorkflowDiagramStepNodeData,
    position: step.position ?? { x: xPos, y: yPos },
  });

  for (const nextStepId of nextStepIds) {
    if (!steps.some((candidate) => candidate.id === nextStepId)) {
      continue;
    }

    updatedEdges.push({
      ...WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION,
      type: edgeType,
      id: v4(),
      source: step.id,
      sourceHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
      target: nextStepId,
      targetHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID,
    });
  }

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
  };
};
