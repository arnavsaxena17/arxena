import {
  WorkflowIfElseAction,
  WorkflowIteratorAction,
  WorkflowRunOutputStepsOutput,
  WorkflowRunStepInfos,
  WorkflowStep,
  WorkflowTrigger,
} from '@/workflow/types/Workflow';
import { FIRST_NODE_POSITION } from '@/workflow/workflow-diagram/constants/FirstNodePosition';
import { VERTICAL_DISTANCE_BETWEEN_TWO_NODES } from '@/workflow/workflow-diagram/constants/VerticalDistanceBetweenTwoNodes';
import { WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeDefaultConfiguration';
import { WORKFLOW_VISUALIZER_EDGE_SUCCESS_CONFIGURATION } from '@/workflow/workflow-diagram/constants/WorkflowVisualizerEdgeSuccessConfiguration';
import {
  WorkflowDiagramEdgeLabelOptions,
  WorkflowDiagramRunStatus,
  WorkflowRunDiagram,
  WorkflowRunDiagramEdge,
  WorkflowRunDiagramNode,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { getWorkflowDiagramTriggerNode } from '@/workflow/workflow-diagram/utils/getWorkflowDiagramTriggerNode';
import { getBranchLabel } from '@/workflow/workflow-steps/workflow-actions/if-else-action/utils/getBranchLabel';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultSourceHandleId';
import { WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeDefaultTargetHandleId';
import { WORKFLOW_DIAGRAM_NODE_ITERATOR_LOOP_SOURCE_HANDLE_ID } from '@/workflow/workflow-diagram/workflow-nodes/constants/WorkflowDiagramNodeIteratorLoopSourceHandleId';
import { TRIGGER_STEP_ID } from '@/workflow/workflow-trigger/constants/TriggerStepId';
import { Position } from '@xyflow/react';
import { isDefined } from 'twenty-shared';
import { v4 } from 'uuid';

const hasGraphInformation = ({
  trigger,
  steps,
}: {
  trigger: WorkflowTrigger;
  steps: Array<WorkflowStep>;
}): boolean => {
  if (isDefined(trigger.nextStepIds) && trigger.nextStepIds.length > 0) {
    return true;
  }

  return steps.some(
    (step) => isDefined(step.nextStepIds) && step.nextStepIds.length > 0,
  );
};

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

const getRunStatusFromStepInfos = ({
  stepId,
  stepInfos,
}: {
  stepId: string;
  stepInfos: WorkflowRunStepInfos;
}): WorkflowDiagramRunStatus => {
  const stepInfo = stepInfos[stepId];

  if (!isDefined(stepInfo)) {
    return 'not-executed';
  }

  switch (stepInfo.status) {
    case 'SUCCESS':
      return 'success';
    case 'FAILED':
      return 'failure';
    case 'RUNNING':
    case 'PENDING':
      return 'running';
    default:
      return 'not-executed';
  }
};

const getRunStatusFromStepsOutput = ({
  stepId,
  stepsOutput,
}: {
  stepId: string;
  stepsOutput: WorkflowRunOutputStepsOutput | undefined;
}): WorkflowDiagramRunStatus => {
  const runResult = stepsOutput?.[stepId];

  if (!isDefined(runResult)) {
    return 'not-executed';
  }

  const lastAttempt = runResult.outputs.at(-1);

  if (!isDefined(lastAttempt)) {
    return 'failure';
  }

  return isDefined(lastAttempt.error) ? 'failure' : 'success';
};

export const generateWorkflowRunDiagram = ({
  trigger,
  steps,
  stepsOutput,
  stepInfos,
}: {
  trigger: WorkflowTrigger;
  steps: Array<WorkflowStep>;
  stepsOutput?: WorkflowRunOutputStepsOutput | undefined;
  stepInfos?: WorkflowRunStepInfos | undefined;
}): WorkflowRunDiagram => {
  const triggerBase = getWorkflowDiagramTriggerNode({ trigger });

  const nodes: Array<WorkflowRunDiagramNode> = [
    {
      ...triggerBase,
      data: {
        ...triggerBase.data,
        runStatus: 'success',
      },
    },
  ];
  const edges: Array<WorkflowRunDiagramEdge> = [];

  const graphMode = hasGraphInformation({ trigger, steps });
  const useStepInfos = isDefined(stepInfos);
  const createdEdgeKeys = new Set<string>();

  const getRunStatus = (stepId: string): WorkflowDiagramRunStatus =>
    useStepInfos
      ? getRunStatusFromStepInfos({ stepId, stepInfos })
      : getRunStatusFromStepsOutput({ stepId, stepsOutput });

  const addEdge = ({
    source,
    target,
    sourceHandle,
    sourceRunStatus,
    labelOptions,
  }: {
    source: string;
    target: string;
    sourceHandle: string;
    sourceRunStatus: WorkflowDiagramRunStatus;
    labelOptions?: WorkflowDiagramEdgeLabelOptions;
  }) => {
    const edgeKey = `${source}:${sourceHandle}->${target}`;

    if (createdEdgeKeys.has(edgeKey)) {
      return;
    }

    if (!steps.some((candidate) => candidate.id === target)) {
      return;
    }

    createdEdgeKeys.add(edgeKey);

    edges.push({
      ...(sourceRunStatus === 'success'
        ? WORKFLOW_VISUALIZER_EDGE_SUCCESS_CONFIGURATION
        : WORKFLOW_VISUALIZER_EDGE_DEFAULT_CONFIGURATION),
      id: v4(),
      source,
      sourceHandle,
      target,
      targetHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_TARGET_HANDLE_ID,
      ...(isDefined(labelOptions) ? { data: { labelOptions } } : {}),
    });
  };

  const triggerNextStepIds = graphMode
    ? (trigger.nextStepIds ?? [])
    : getLegacyNextStepIds({ stepId: TRIGGER_STEP_ID, steps });

  for (const nextStepId of triggerNextStepIds) {
    addEdge({
      source: TRIGGER_STEP_ID,
      target: nextStepId,
      sourceHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
      sourceRunStatus: 'success',
    });
  }

  let levelYPos = FIRST_NODE_POSITION.y;

  for (const step of steps) {
    levelYPos += VERTICAL_DISTANCE_BETWEEN_TWO_NODES;

    const runStatus = getRunStatus(step.id);

    let sourceHandleIds: string[] | undefined;

    if (graphMode && step.type === 'IF_ELSE') {
      sourceHandleIds = (
        (step as WorkflowIfElseAction).settings?.input?.branches ?? []
      ).map((branch) => branch.id);
    } else if (graphMode && step.type === 'ITERATOR') {
      sourceHandleIds = [
        WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
        WORKFLOW_DIAGRAM_NODE_ITERATOR_LOOP_SOURCE_HANDLE_ID,
      ];
    }

    nodes.push({
      id: step.id,
      data: {
        nodeType: 'action',
        actionType: step.type,
        name: step.name,
        isLeafNode: false,
        runStatus,
        ...(isDefined(sourceHandleIds) ? { sourceHandleIds } : {}),
      },
      position: step.position ?? {
        x: FIRST_NODE_POSITION.x,
        y: levelYPos,
      },
    });

    if (graphMode && step.type === 'IF_ELSE') {
      const branches =
        (step as WorkflowIfElseAction).settings?.input?.branches ?? [];
      const totalBranches = branches.length;

      branches.forEach((branch, branchIndex) => {
        const label = getBranchLabel({ branchIndex, totalBranches, branch });

        for (const nextStepId of branch.nextStepIds) {
          addEdge({
            source: step.id,
            target: nextStepId,
            sourceHandle: branch.id,
            sourceRunStatus: runStatus,
            labelOptions: { position: Position.Bottom, label },
          });
        }
      });

      continue;
    }

    if (graphMode && step.type === 'ITERATOR') {
      const initialLoopStepIds =
        (step as WorkflowIteratorAction).settings?.input?.initialLoopStepIds ??
        [];

      for (const loopStepId of initialLoopStepIds) {
        addEdge({
          source: step.id,
          target: loopStepId,
          sourceHandle: WORKFLOW_DIAGRAM_NODE_ITERATOR_LOOP_SOURCE_HANDLE_ID,
          sourceRunStatus: runStatus,
          labelOptions: { position: Position.Left, label: 'Loop' },
        });
      }

      for (const nextStepId of step.nextStepIds ?? []) {
        addEdge({
          source: step.id,
          target: nextStepId,
          sourceHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
          sourceRunStatus: runStatus,
        });
      }

      continue;
    }

    const nextStepIds = graphMode
      ? (step.nextStepIds ?? [])
      : getLegacyNextStepIds({ stepId: step.id, steps });

    for (const nextStepId of nextStepIds) {
      addEdge({
        source: step.id,
        target: nextStepId,
        sourceHandle: WORKFLOW_DIAGRAM_NODE_DEFAULT_SOURCE_HANDLE_ID,
        sourceRunStatus: runStatus,
      });
    }
  }

  return {
    nodes,
    edges,
  };
};
