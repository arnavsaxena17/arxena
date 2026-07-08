import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { FIRST_NODE_POSITION } from '@/workflow/workflow-diagram/constants/FirstNodePosition';
import { VERTICAL_DISTANCE_BETWEEN_TWO_NODES } from '@/workflow/workflow-diagram/constants/VerticalDistanceBetweenTwoNodes';
import { WORKFLOW_DIAGRAM_EMPTY_TRIGGER_NODE_DEFINITION } from '@/workflow/workflow-diagram/constants/WorkflowDiagramEmptyTriggerNodeDefinition';
import { WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeDefaultConfiguration';
import { WorkflowContext } from '@/workflow/workflow-diagram/types/WorkflowContext';
import {
  WorkflowDiagram,
  WorkflowDiagramEdge,
  WorkflowDiagramNode,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { generateNodesAndEdgesForDefaultNode } from '@/workflow/workflow-diagram/utils/generateNodesAndEdgesForDefaultNode';
import { generateNodesAndEdgesForIfElseNode } from '@/workflow/workflow-diagram/utils/generateNodesAndEdgesForIfElseNode';
import { generateNodesAndEdgesForIteratorNode } from '@/workflow/workflow-diagram/utils/generateNodesAndEdgesForIteratorNode';
import { getEdgeTypeBetweenTwoNodes } from '@/workflow/workflow-diagram/utils/getEdgeTypeBetweenTwoNodes';
import { getWorkflowDiagramTriggerNode } from '@/workflow/workflow-diagram/utils/getWorkflowDiagramTriggerNode';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultSourceHandleId';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultTargetHandleId';
import { TRIGGER_STEP_ID } from '@/workflow/workflow-trigger/constants/TriggerStepId';
import { isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

const hasGraphInformation = ({
  trigger,
  steps,
}: {
  trigger: WorkflowTrigger | undefined;
  steps: Array<WorkflowStep>;
}): boolean => {
  if (isDefined(trigger?.nextStepIds) && trigger.nextStepIds.length > 0) {
    return true;
  }

  return steps.some(
    (step) => isDefined(step.nextStepIds) && step.nextStepIds.length > 0,
  );
};

/**
 * When a workflow predates the graph model (no nextStepIds anywhere) we
 * synthesize a linear chain trigger -> step[0] -> step[1] -> ... so legacy
 * workflows keep rendering.
 */
const getLegacyNextStepIds = ({
  stepId,
  steps,
}: {
  stepId: string;
  steps: Array<WorkflowStep>;
}): string[] => {
  const stepIdsInOrder = steps.map((step) => step.id);

  if (stepId === TRIGGER_STEP_ID) {
    return stepIdsInOrder.length > 0 ? [stepIdsInOrder[0]] : [];
  }

  const index = stepIdsInOrder.indexOf(stepId);

  if (index === -1 || index === stepIdsInOrder.length - 1) {
    return [];
  }

  return [stepIdsInOrder[index + 1]];
};

export const generateWorkflowDiagram = ({
  trigger,
  steps,
  workflowContext = 'workflow',
}: {
  trigger: WorkflowTrigger | undefined;
  steps: Array<WorkflowStep>;
  workflowContext?: WorkflowContext;
}): WorkflowDiagram => {
  let nodes: Array<WorkflowDiagramNode> = [];
  let edges: Array<WorkflowDiagramEdge> = [];

  const edgeType = getEdgeTypeBetweenTwoNodes({ workflowContext });
  const graphMode = hasGraphInformation({ trigger, steps });

  if (isDefined(trigger)) {
    nodes.push(getWorkflowDiagramTriggerNode({ trigger }));
  } else {
    nodes.push(WORKFLOW_DIAGRAM_EMPTY_TRIGGER_NODE_DEFINITION);
  }

  const triggerNextStepIds = graphMode
    ? (trigger?.nextStepIds ?? [])
    : getLegacyNextStepIds({ stepId: TRIGGER_STEP_ID, steps });

  for (const nextStepId of triggerNextStepIds) {
    if (!steps.some((candidate) => candidate.id === nextStepId)) {
      continue;
    }

    edges.push({
      ...WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION,
      type: edgeType,
      id: v4(),
      source: TRIGGER_STEP_ID,
      sourceHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
      target: nextStepId,
      targetHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID,
    });
  }

  const xPos = FIRST_NODE_POSITION.x;
  let levelYPos = FIRST_NODE_POSITION.y;

  for (const step of steps) {
    levelYPos += VERTICAL_DISTANCE_BETWEEN_TWO_NODES;

    if (graphMode && step.type === 'IF_ELSE') {
      const generated = generateNodesAndEdgesForIfElseNode({
        step,
        steps,
        xPos,
        yPos: levelYPos,
        nodes,
        edges,
        workflowContext,
      });

      nodes = generated.nodes;
      edges = generated.edges;

      continue;
    }

    if (graphMode && step.type === 'ITERATOR') {
      const generated = generateNodesAndEdgesForIteratorNode({
        step,
        steps,
        xPos,
        yPos: levelYPos,
        nodes,
        edges,
        workflowContext,
      });

      nodes = generated.nodes;
      edges = generated.edges;

      continue;
    }

    const generated = generateNodesAndEdgesForDefaultNode({
      step,
      nextStepIds: graphMode
        ? (step.nextStepIds ?? [])
        : getLegacyNextStepIds({ stepId: step.id, steps }),
      steps,
      xPos,
      yPos: levelYPos,
      nodes,
      edges,
      workflowContext,
    });

    nodes = generated.nodes;
    edges = generated.edges;
  }

  return {
    nodes,
    edges,
  };
};
