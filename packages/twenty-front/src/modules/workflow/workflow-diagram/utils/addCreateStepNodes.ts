import { WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeDefaultConfiguration';
import {
  WorkflowDiagram,
  WorkflowDiagramCreateStepConnectionOptions,
  WorkflowDiagramEdge,
  WorkflowDiagramNode,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultSourceHandleId';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultTargetHandleId';
import { WORKFLOW_DIAGRAM_NODE_ITERATOR_LOOP_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeIteratorLoopSourceHandleId';
import { isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

const getConnectionOptionsForHandle = ({
  node,
  handleId,
}: {
  node: WorkflowDiagramNode;
  handleId: string;
}): WorkflowDiagramCreateStepConnectionOptions => {
  if (node.data.nodeType === 'action' && node.data.actionType === 'IF_ELSE') {
    return { sourceHandleId: handleId, branchId: handleId };
  }

  if (
    node.data.nodeType === 'action' &&
    node.data.actionType === 'ITERATOR' &&
    handleId === WORKFLOW_DIAGRAM_NODE_ITERATOR_LOOP_SOURCE_HANDLE_ID
  ) {
    return { sourceHandleId: handleId, isLoopEntry: true };
  }

  return { sourceHandleId: handleId };
};

const getSourceHandleIdsForNode = (node: WorkflowDiagramNode): string[] => {
  if (
    node.data.nodeType === 'create-step' ||
    node.data.nodeType === 'empty-trigger'
  ) {
    return [];
  }

  const sourceHandleIds = node.data.sourceHandleIds;

  if (isDefined(sourceHandleIds) && sourceHandleIds.length > 0) {
    return sourceHandleIds;
  }

  return [WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID];
};

export const addCreateStepNodes = ({ nodes, edges }: WorkflowDiagram) => {
  const updatedNodes: Array<WorkflowDiagramNode> = nodes.slice();
  const updatedEdges: Array<WorkflowDiagramEdge> = edges.slice();

  for (const node of nodes) {
    if (
      node.data.nodeType === 'create-step' ||
      node.data.nodeType === 'empty-trigger'
    ) {
      continue;
    }

    for (const handleId of getSourceHandleIdsForNode(node)) {
      const handleHasChild = edges.some(
        (edge) =>
          edge.source === node.id &&
          (edge.sourceHandle ?? WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID) ===
            handleId,
      );

      if (handleHasChild) {
        continue;
      }

      const connectionOptions = getConnectionOptionsForHandle({
        node,
        handleId,
      });

      const createStepNodeId = `${node.id}__${handleId}__create-step`;

      updatedNodes.push({
        id: createStepNodeId,
        type: 'create-step',
        data: {
          nodeType: 'create-step',
          parentNodeId: node.id,
          connectionOptions,
        },
        position: { x: 0, y: 0 },
      });

      updatedEdges.push({
        ...WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION,
        id: v4(),
        source: node.id,
        sourceHandle: handleId,
        target: createStepNodeId,
        targetHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID,
      });
    }
  }

  return {
    nodes: updatedNodes,
    edges: updatedEdges,
  };
};
