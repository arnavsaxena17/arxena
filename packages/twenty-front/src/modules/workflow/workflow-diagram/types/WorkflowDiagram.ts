import {
  WorkflowActionType,
  WorkflowTriggerType,
} from '@/workflow/types/Workflow';
import { Edge, Node, Position } from '@xyflow/react';

export type WorkflowDiagramEdgeLabelOptions = {
  label: string;
  position?: Position;
  elseIfIndex?: number;
};

export type WorkflowDiagramEdgeData = {
  labelOptions?: WorkflowDiagramEdgeLabelOptions;
};

export type WorkflowDiagramNode = Node<WorkflowDiagramNodeData>;
export type WorkflowDiagramEdge = Edge<WorkflowDiagramEdgeData>;

export type WorkflowRunDiagramNode = Node<WorkflowRunDiagramNodeData>;
export type WorkflowRunDiagramEdge = Edge<WorkflowDiagramEdgeData>;

export type WorkflowRunDiagram = {
  nodes: Array<WorkflowRunDiagramNode>;
  edges: Array<WorkflowRunDiagramEdge>;
};

export type WorkflowDiagram = {
  nodes: Array<WorkflowDiagramNode>;
  edges: Array<WorkflowDiagramEdge>;
};

export type WorkflowDiagramRunStatus =
  | 'running'
  | 'success'
  | 'failure'
  | 'not-executed';

export type WorkflowDiagramStepNodeData =
  | {
      nodeType: 'trigger';
      triggerType: WorkflowTriggerType;
      name: string;
      icon?: string;
      runStatus?: WorkflowDiagramRunStatus;
      isLeafNode: boolean;
      sourceHandleIds?: string[];
    }
  | {
      nodeType: 'action';
      actionType: WorkflowActionType;
      name: string;
      runStatus?: WorkflowDiagramRunStatus;
      isLeafNode: boolean;
      sourceHandleIds?: string[];
    };

export type WorkflowDiagramCreateStepConnectionOptions = {
  sourceHandleId?: string;
  branchId?: string;
  isLoopEntry?: boolean;
  nextStepId?: string;
};

export type WorkflowDiagramCreateStepNodeData = {
  nodeType: 'create-step';
  parentNodeId: string;
  connectionOptions?: WorkflowDiagramCreateStepConnectionOptions;
  isLeafNode?: never;
};

export type WorkflowDiagramEmptyTriggerNodeData = {
  nodeType: 'empty-trigger';
  isLeafNode: boolean;
};

export type WorkflowDiagramNodeData =
  | WorkflowDiagramStepNodeData
  | WorkflowDiagramCreateStepNodeData
  | WorkflowDiagramEmptyTriggerNodeData;

export type WorkflowRunDiagramNodeData = Exclude<
  WorkflowDiagramStepNodeData,
  'runStatus'
> & { runStatus: WorkflowDiagramRunStatus };

export type WorkflowDiagramNodeType =
  | 'default'
  | 'empty-trigger'
  | 'create-step';

export type WorkflowDiagramEdgeType = 'default' | 'success';
