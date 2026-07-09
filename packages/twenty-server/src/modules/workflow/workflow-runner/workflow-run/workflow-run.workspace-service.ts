import { Injectable } from '@nestjs/common';

import {
  StepStatus,
  type WorkflowRunStepInfo,
  type WorkflowRunStepInfos,
} from 'twenty-shared';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { ActorMetadata } from 'src/engine/metadata-modules/field-metadata/composite-types/actor.composite-type';
import { TwentyORMManager } from 'src/engine/twenty-orm/twenty-orm.manager';
import {
  WorkflowRunStatus,
  type WorkflowRunState,
  WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';

@Injectable()
export class WorkflowRunWorkspaceService {
  constructor(
    private readonly twentyORMManager: TwentyORMManager,
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
  ) {}

  async createWorkflowRun({
    workflowVersionId,
    createdBy,
  }: {
    workflowVersionId: string;
    createdBy: ActorMetadata;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowVersion =
      await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail(
        workflowVersionId,
      );

    return (
      await workflowRunRepository.save({
        name: `Execution of ${workflowVersion.name}`,
        workflowVersionId,
        createdBy,
        workflowId: workflowVersion.workflowId,
        status: WorkflowRunStatus.NOT_STARTED,
      })
    ).id;
  }

  async startWorkflowRun({
    workflowRunId,
    trigger,
    steps,
    triggerPayload,
  }: {
    workflowRunId: string;
    trigger: WorkflowTrigger;
    steps: WorkflowAction[];
    triggerPayload: object;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowRunToUpdate = await workflowRunRepository.findOneBy({
      id: workflowRunId,
    });

    if (!workflowRunToUpdate) {
      throw new WorkflowRunException(
        'No workflow run to start',
        WorkflowRunExceptionCode.WORKFLOW_RUN_NOT_FOUND,
      );
    }

    if (workflowRunToUpdate.status !== WorkflowRunStatus.NOT_STARTED) {
      throw new WorkflowRunException(
        'Workflow run already started',
        WorkflowRunExceptionCode.INVALID_OPERATION,
      );
    }

    const state: WorkflowRunState = {
      flow: {
        trigger,
        steps,
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: triggerPayload },
        ...Object.fromEntries(
          steps.map((step) => [step.id, { status: StepStatus.NOT_STARTED }]),
        ),
      },
    };

    return workflowRunRepository.update(workflowRunToUpdate.id, {
      status: WorkflowRunStatus.RUNNING,
      startedAt: new Date().toISOString(),
      context: { trigger: triggerPayload },
      output: {
        flow: {
          trigger,
          steps,
        },
      },
      state,
    } as unknown as QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>);
  }

  async getWorkflowRunOrFail({
    workflowRunId,
  }: {
    workflowRunId: string;
    workspaceId?: string;
  }): Promise<WorkflowRunWorkspaceEntity> {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowRun = await workflowRunRepository.findOneBy({
      id: workflowRunId,
    });

    if (!workflowRun) {
      throw new WorkflowRunException(
        'Workflow run not found',
        WorkflowRunExceptionCode.WORKFLOW_RUN_NOT_FOUND,
      );
    }

    return workflowRun;
  }

  async updateWorkflowRunStepInfo({
    stepId,
    stepInfo,
    workflowRunId,
  }: {
    stepId: string;
    stepInfo: WorkflowRunStepInfo;
    workflowRunId: string;
    workspaceId?: string;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowRunToUpdate = await this.getWorkflowRunOrFail({
      workflowRunId,
    });

    const nextState: WorkflowRunState = {
      ...(workflowRunToUpdate.state as WorkflowRunState),
      stepInfos: {
        ...workflowRunToUpdate.state?.stepInfos,
        [stepId]: {
          ...workflowRunToUpdate.state?.stepInfos?.[stepId],
          result: stepInfo?.result,
          error: stepInfo?.error,
          status: stepInfo.status,
        },
      },
    };

    return workflowRunRepository.update(workflowRunId, {
      state: nextState,
    } as unknown as QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>);
  }

  async updateWorkflowRunStepInfos({
    stepInfos,
    workflowRunId,
  }: {
    stepInfos: WorkflowRunStepInfos;
    workflowRunId: string;
    workspaceId?: string;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowRunToUpdate = await this.getWorkflowRunOrFail({
      workflowRunId,
    });

    const existingStepInfos = workflowRunToUpdate.state?.stepInfos ?? {};

    const mergedStepInfos: WorkflowRunStepInfos = { ...existingStepInfos };

    for (const [stepId, info] of Object.entries(stepInfos)) {
      mergedStepInfos[stepId] = {
        ...existingStepInfos[stepId],
        ...info,
      };
    }

    const nextState: WorkflowRunState = {
      ...(workflowRunToUpdate.state as WorkflowRunState),
      stepInfos: mergedStepInfos,
    };

    return workflowRunRepository.update(workflowRunId, {
      state: nextState,
    } as unknown as QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>);
  }

  async updateWorkflowRun({
    workflowRunId,
    partialUpdate,
  }: {
    workflowRunId: string;
    workspaceId?: string;
    partialUpdate: QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    await this.getWorkflowRunOrFail({
      workflowRunId,
    });

    return workflowRunRepository.update(workflowRunId, partialUpdate);
  }

  async endWorkflowRun({
    workflowRunId,
    status,
    error,
  }: {
    workflowRunId: string;
    status: WorkflowRunStatus;
    error?: string;
    isSystemError?: boolean;
    workspaceId?: string;
  }) {
    const workflowRunRepository =
      await this.twentyORMManager.getRepository<WorkflowRunWorkspaceEntity>(
        'workflowRun',
      );

    const workflowRunToUpdate = await this.getWorkflowRunOrFail({
      workflowRunId,
    });

    const updatedStepInfos = this.markRunningStepsAsFailed({
      stepInfosToUpdate: workflowRunToUpdate.state?.stepInfos ?? {},
    });

    const nextState: WorkflowRunState | undefined = workflowRunToUpdate.state
      ? {
          ...(workflowRunToUpdate.state as WorkflowRunState),
          workflowRunError: error,
          stepInfos: updatedStepInfos,
        }
      : undefined;

    return workflowRunRepository.update(workflowRunToUpdate.id, {
      status,
      endedAt: new Date().toISOString(),
      state: nextState,
      output: {
        ...(workflowRunToUpdate.output ?? {
          flow: { trigger: undefined, steps: [] },
        }),
        error,
      },
    } as unknown as QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>);
  }

  private markRunningStepsAsFailed({
    stepInfosToUpdate,
  }: {
    stepInfosToUpdate: WorkflowRunStepInfos;
  }): WorkflowRunStepInfos {
    return Object.entries(stepInfosToUpdate ?? {}).reduce(
      (acc, [stepId, step]) => {
        if (
          step.status === StepStatus.RUNNING ||
          step.status === StepStatus.PENDING
        ) {
          acc[stepId] = {
            ...step,
            status: StepStatus.FAILED,
            error: 'Workflow has been ended before this step was completed',
          };

          return acc;
        }

        acc[stepId] = step;

        return acc;
      },
      {} as WorkflowRunStepInfos,
    );
  }
}
