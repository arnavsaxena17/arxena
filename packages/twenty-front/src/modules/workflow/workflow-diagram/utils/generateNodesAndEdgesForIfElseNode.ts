import { WorkflowIfElseAction, WorkflowStep } from '@/workflow/types/Workflow';
import { WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeDefaultConfiguration';
import { WorkflowContext } from '@/workflow/workflow-diagram/types/WorkflowContext';
import {
  WorkflowDiagramEdge,
  WorkflowDiagramNode,
  WorkflowDiagramStepNodeData,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { getEdgeTypeBetweenTwoNodes } from '@/workflow/workflow-diagram/utils/getEdgeTypeBetweenTwoNodes';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultTargetHandleId';
import { getBranchLabel } from '@/workflow/workflow-steps/workflow-actions/if-else-action/utils/getBranchLabel';
import { Position } from '@xyflow/react';
import { isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

export const generateNodesAndEdgesForIfElseNode = ({
  step,
  steps,
  xPos,
  yPos,
  nodes,
  edges,
  workflowContext,
}: {
  step: WorkflowIfElseAction;
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

  const branches = step.settings?.input?.branches ?? [];

  updatedNodes.push({
    id: step.id,
    data: {
      nodeType: 'action',
      actionType: step.type,
      name: step.name,
      isLeafNode: false,
      sourceHandleIds: branches.map((branch) => branch.id),
    } satisfies WorkflowDiagramStepNodeData,
    position: step.position ?? { x: xPos, y: yPos },
  });

  const totalBranches = branches.length;

  branches.forEach((branch, branchIndex) => {
    const label = getBranchLabel({ branchIndex, totalBranches, branch });

    const elseIfIndex =
      branchIndex > 0 &&
      branchIndex < totalBranches - 1 &&
      isDefined(branch.filterGroupId)
        ? branchIndex
        : undefined;

    for (const nextStepId of branch.nextStepIds) {
      if (!steps.some((candidate) => candidate.id === nextStepId)) {
        continue;
      }

      updatedEdges.push({
        ...WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION,
        type: edgeType,
        id: v4(),
        source: step.id,
        sourceHandle: branch.id,
        target: nextStepId,
        targetHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID,
        data: {
          labelOptions: {
            position: Position.Bottom,
            label,
            elseIfIndex,
          },
        },
      });
    }
  });

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
  };
};
