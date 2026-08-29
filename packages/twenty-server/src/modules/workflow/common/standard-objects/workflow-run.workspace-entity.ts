import { registerEnumType } from '@nestjs/graphql';

import { type ActorMetadata } from 'twenty-shared/types';
import {
  type WorkflowRunStepInfos,
  type WorkflowRunStepLogs,
} from 'twenty-shared/workflow';

import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type TimelineActivityWorkspaceEntity } from 'src/modules/timeline/standard-objects/timeline-activity.workspace-entity';
import { type WorkflowVersionWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { type WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

export enum WorkflowRunStatus {
  NOT_STARTED = 'NOT_STARTED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  ENQUEUED = 'ENQUEUED',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
}

export enum WorkflowRunCurrentStepKind {
  EXECUTING = 'EXECUTING',
  RATE_LIMITED = 'RATE_LIMITED',
  DELAY = 'DELAY',
  FORM = 'FORM',
  PENDING = 'PENDING',
}

registerEnumType(WorkflowRunStatus, {
  name: 'WorkflowRunStatusEnum',
  description: 'Status of the workflow run',
});

export type StepOutput = {
  id: string;
  output: WorkflowActionOutput;
};

export type WorkflowRunOutput = {
  flow: {
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
  };
  stepsOutput?: Record<string, WorkflowActionOutput>;
  error?: string;
};

export type WorkflowRunState = {
  flow: {
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
  };
  stepInfos: WorkflowRunStepInfos;
  workflowRunError?: string;
};

export class WorkflowRunWorkspaceEntity extends BaseWorkspaceEntity {
  name: string | null;
  relatedRecordId: string | null;
  relatedObjectName: string | null;
  candidateId: string | null;
  enqueuedAt: Date | null;
  startedAt: string | null;
  endedAt: string | null;
  status: WorkflowRunStatus;
  currentStepName: string | null;
  currentStepKind: WorkflowRunCurrentStepKind | null;
  resumeAt: string | null;
  upcomingSteps: string | null;
  createdBy: ActorMetadata;
  updatedBy: ActorMetadata;
  state: WorkflowRunState;
  stepLogs: WorkflowRunStepLogs | null;
  position: number;
  searchVector: string;
  workflowVersion: EntityRelation<WorkflowVersionWorkspaceEntity>;
  workflowVersionId: string;
  workflow: EntityRelation<WorkflowWorkspaceEntity>;
  workflowId: string;
  timelineActivities: EntityRelation<TimelineActivityWorkspaceEntity[]>;
}
