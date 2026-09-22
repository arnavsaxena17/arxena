import { Injectable } from '@nestjs/common';

import { type ActorMetadata } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { StepStatus, type WorkflowRunStepInfo } from 'twenty-shared/workflow';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { v4 } from 'uuid';

import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { MetricsKeys } from 'src/engine/core-modules/metrics/types/metrics-keys.type';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { RecordPositionService } from 'src/engine/core-modules/record-position/services/record-position.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import {
  WorkflowRunStatus,
  type WorkflowRunState,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowVersionWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { computeWorkflowRunProgressFields } from 'src/modules/workflow/workflow-runner/utils/compute-workflow-run-progress-fields.util';
import {
  buildWorkflowRunName,
  extractWorkflowRunTriggerRecord,
} from 'src/modules/workflow/workflow-runner/utils/extract-workflow-run-trigger-record.util';
import { mergeWorkflowRunStepInfo } from 'src/modules/workflow/workflow-runner/utils/merge-workflow-run-step-info.util';
import { normalizeOutreachHomeWorkflowPayload } from 'src/modules/workflow/workflow-runner/utils/normalize-outreach-home-workflow-payload.util';

type CandidateProjectIdRecord = {
  projectId?: string | null;
};

const TERMINAL_WORKFLOW_RUN_STATUSES = [
  WorkflowRunStatus.COMPLETED,
  WorkflowRunStatus.FAILED,
  WorkflowRunStatus.STOPPED,
] as const;

const WORKFLOW_RUN_STATE_VERSION_MAX_RETRIES = 25;
const WORKFLOW_RUN_STATE_VERSION_RETRY_DELAY_MS = 20;

type WorkflowRunMutationResult =
  | {
      partialUpdate: QueryDeepPartialEntity<WorkflowRunWorkspaceEntity>;
    }
  | null;

@Injectable()
export class WorkflowRunWorkspaceService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly recordPositionService: RecordPositionService,
    private readonly metricsService: MetricsService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
  ) {}

  async createWorkflowRun({
    workflowVersionId,
    createdBy,
    workflowRunId,
    status,
    triggerPayload,
    error,
    workspaceId,
  }: {
    workflowVersionId: string;
    createdBy: ActorMetadata;
    status:
      | WorkflowRunStatus.NOT_STARTED
      | WorkflowRunStatus.ENQUEUED
      | WorkflowRunStatus.FAILED;
    triggerPayload: object;
    workflowRunId?: string;
    error?: string;
    workspaceId: string;
  }) {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );

        const workflowVersion =
          await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
            workspaceId,
            workflowVersionId,
          });

        const workflowRepository =
          await this.globalWorkspaceOrmManager.getRepository(
            workspaceId,
            'workflow',
            { shouldBypassPermissionChecks: true },
          );

        const workflow = await workflowRepository.findOne({
          where: {
            id: workflowVersion.workflowId,
          },
        });

        if (!workflow) {
          throw new WorkflowRunException(
            'Workflow id is invalid',
            WorkflowRunExceptionCode.WORKFLOW_RUN_INVALID,
          );
        }

        const position = await this.recordPositionService.buildRecordPosition({
          value: 'first',
          objectMetadata: {
            isCustom: false,
            nameSingular: 'workflowRun',
          },
          workspaceId,
        });

        const normalizedTriggerPayload =
          normalizeOutreachHomeWorkflowPayload(triggerPayload);

        const initState = this.getInitState(
          workflowVersion,
          normalizedTriggerPayload,
          error,
        );

        const lastWorkflowRun = await workflowRunRepository.findOne({
          where: {
            workflowId: workflow.id,
          },
          order: { createdAt: 'desc' },
        });

        const workflowRunCountMatch = lastWorkflowRun?.name?.match(/#(\d+)/);

        const workflowRunCount = workflowRunCountMatch
          ? parseInt(workflowRunCountMatch[1], 10)
          : 0;

        const relatedRecord = extractWorkflowRunTriggerRecord({
          trigger: workflowVersion.trigger,
          triggerPayload: normalizedTriggerPayload,
        });

        const workflowRun = {
          id: workflowRunId ?? v4(),
          name: buildWorkflowRunName({
            runNumber: workflowRunCount + 1,
            workflowName: workflow.name ?? '',
            recordLabel: relatedRecord?.recordLabel,
          }),
          relatedRecordId: relatedRecord?.recordId ?? null,
          relatedObjectName: relatedRecord?.objectNameSingular ?? null,
          candidateId:
            relatedRecord?.objectNameSingular === 'candidate'
              ? relatedRecord.recordId
              : null,
          ...computeWorkflowRunProgressFields({
            state: initState,
            status,
          }),
          workflowVersionId,
          createdBy,
          workflowId: workflow.id,
          status,
          position,
          state: initState,
          stateVersion: 0,
          enqueuedAt: status === WorkflowRunStatus.ENQUEUED ? new Date() : null,
        };

        await workflowRunRepository.insert(workflowRun);

        return workflowRun.id;
      },
      authContext,
    );
  }

  async startWorkflowRun({
    workflowRunId,
    workspaceId,
  }: {
    workflowRunId: string;
    workspaceId: string;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate: (workflowRunToUpdate) => {
        if (
          workflowRunToUpdate.status !== WorkflowRunStatus.ENQUEUED &&
          workflowRunToUpdate.status !== WorkflowRunStatus.NOT_STARTED
        ) {
          throw new WorkflowRunException(
            'Workflow run is not enqueued or not started',
            WorkflowRunExceptionCode.INVALID_OPERATION,
          );
        }

        return {
          partialUpdate: {
            status: WorkflowRunStatus.RUNNING,
            startedAt: new Date().toISOString(),
            state: {
              ...workflowRunToUpdate.state,
              stepInfos: {
                ...workflowRunToUpdate.state?.stepInfos,
                trigger: {
                  result: {},
                  ...workflowRunToUpdate.state?.stepInfos.trigger,
                  status: StepStatus.SUCCESS,
                },
              },
            },
          },
        };
      },
    });
  }

  async endWorkflowRun({
    workflowRunId,
    workspaceId,
    status,
    error,
    isSystemError,
  }: {
    workflowRunId: string;
    workspaceId: string;
    status: Extract<WorkflowRunStatus, 'COMPLETED' | 'FAILED' | 'STOPPED'>;
    error?: string;
    isSystemError?: boolean;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate: (workflowRunToUpdate) => {
        const updatedStepInfos = this.markRunningStepsAsFailed({
          stepInfosToUpdate: workflowRunToUpdate.state?.stepInfos ?? {},
        });

        return {
          partialUpdate: {
            status,
            endedAt: new Date().toISOString(),
            state: {
              ...workflowRunToUpdate.state,
              workflowRunError: error,
              stepInfos: updatedStepInfos,
            },
          },
        };
      },
    });

    if (
      status === WorkflowRunStatus.STOPPED ||
      status === WorkflowRunStatus.FAILED
    ) {
      try {
        await getRegisteredAccountRateLimiter()?.releaseGhostReservationsForWorkflowRun(
          workflowRunId,
        );
      } catch {
        // Ending the run must not fail because unused slot cleanup failed.
      }
    }

    const metricKey =
      status === WorkflowRunStatus.COMPLETED
        ? MetricsKeys.WorkflowRunCompleted
        : status === WorkflowRunStatus.STOPPED
          ? MetricsKeys.WorkflowRunStopped
          : MetricsKeys.WorkflowRunFailed;

    await this.metricsService.incrementCounterForEvent({
      key: metricKey,
      eventId: workflowRunId,
    });

    if (isSystemError) {
      await this.metricsService.incrementCounterForEvent({
        key: MetricsKeys.WorkflowRunSystemError,
        eventId: workflowRunId,
        debugLog: `[Workflow Run System Error] Workflow run ${workflowRunId} in workspace ${workspaceId} ended with system error`,
      });
    }
  }

  async updateWorkflowRunStepInfo({
    stepId,
    stepInfo,
    workflowRunId,
    workspaceId,
  }: {
    stepId: string;
    stepInfo: WorkflowRunStepInfo;
    workflowRunId: string;
    workspaceId: string;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate: (workflowRunToUpdate) => {
        if (this.isTerminalWorkflowRunStatus(workflowRunToUpdate.status)) {
          return null;
        }

        return {
          partialUpdate: {
            state: {
              ...workflowRunToUpdate.state,
              stepInfos: {
                ...workflowRunToUpdate.state?.stepInfos,
                [stepId]: mergeWorkflowRunStepInfo(
                  workflowRunToUpdate.state?.stepInfos[stepId],
                  stepInfo,
                ),
              },
            },
          },
        };
      },
    });
  }

  async updateWorkflowRunStepInfos({
    stepInfos,
    workflowRunId,
    workspaceId,
  }: {
    stepInfos: Record<string, WorkflowRunStepInfo>;
    workflowRunId: string;
    workspaceId: string;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate: (workflowRunToUpdate) => {
        if (this.isTerminalWorkflowRunStatus(workflowRunToUpdate.status)) {
          return null;
        }

        const existingStepInfos = workflowRunToUpdate.state?.stepInfos ?? {};
        const mergedStepInfos = { ...existingStepInfos };

        for (const [stepId, info] of Object.entries(stepInfos)) {
          mergedStepInfos[stepId] = mergeWorkflowRunStepInfo(
            existingStepInfos[stepId],
            info,
          );
        }

        return {
          partialUpdate: {
            state: {
              ...workflowRunToUpdate.state,
              stepInfos: mergedStepInfos,
            },
          },
        };
      },
    });
  }

  async updateWorkflowRunStep({
    workflowRunId,
    step,
    workspaceId,
  }: {
    workflowRunId: string;
    step: WorkflowAction;
    workspaceId: string;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate: (workflowRunToUpdate) => {
        if (
          workflowRunToUpdate.status === WorkflowRunStatus.COMPLETED ||
          workflowRunToUpdate.status === WorkflowRunStatus.FAILED
        ) {
          throw new WorkflowRunException(
            'Cannot update steps of a completed or failed workflow run',
            WorkflowRunExceptionCode.INVALID_OPERATION,
          );
        }

        const updatedSteps = workflowRunToUpdate.state?.flow?.steps?.map(
          (existingStep) => (step.id === existingStep.id ? step : existingStep),
        );

        return {
          partialUpdate: {
            state: {
              ...workflowRunToUpdate.state,
              flow: {
                ...workflowRunToUpdate.state?.flow,
                steps: updatedSteps,
              },
            },
          },
        };
      },
    });
  }

  async getWorkflowRun({
    workflowRunId,
    workspaceId,
  }: {
    workflowRunId: string;
    workspaceId: string;
  }): Promise<WorkflowRunWorkspaceEntity | null> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );

        return await workflowRunRepository.findOne({
          where: { id: workflowRunId },
        });
      },
      authContext,
    );
  }

  async getWorkflowRunOrFail({
    workflowRunId,
    workspaceId,
  }: {
    workflowRunId: string;
    workspaceId: string;
  }): Promise<WorkflowRunWorkspaceEntity> {
    const workflowRun = await this.getWorkflowRun({
      workflowRunId,
      workspaceId,
    });

    if (!workflowRun) {
      throw new WorkflowRunException(
        'Workflow run not found',
        WorkflowRunExceptionCode.WORKFLOW_RUN_NOT_FOUND,
      );
    }

    return workflowRun;
  }

  async updateWorkflowRun({
    workflowRunId,
    workspaceId,
    mutate,
  }: {
    workflowRunId: string;
    workspaceId: string;
    mutate: (
      current: WorkflowRunWorkspaceEntity,
    ) => WorkflowRunMutationResult;
  }) {
    await this.applyWorkflowRunMutation({
      workflowRunId,
      workspaceId,
      mutate,
    });
  }

  private async applyWorkflowRunMutation({
    workflowRunId,
    workspaceId,
    mutate,
  }: {
    workflowRunId: string;
    workspaceId: string;
    mutate: (
      current: WorkflowRunWorkspaceEntity,
    ) => WorkflowRunMutationResult;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );

      for (
        let attempt = 0;
        attempt < WORKFLOW_RUN_STATE_VERSION_MAX_RETRIES;
        attempt++
      ) {
        const workflowRunToUpdate = await workflowRunRepository.findOneBy({
          id: workflowRunId,
        });

        if (!workflowRunToUpdate) {
          throw new WorkflowRunException(
            `workflowRun ${workflowRunId} not found`,
            WorkflowRunExceptionCode.WORKFLOW_RUN_NOT_FOUND,
          );
        }

        const mutationResult = mutate(workflowRunToUpdate);

        if (!isDefined(mutationResult)) {
          return;
        }

        const { partialUpdate } = mutationResult;
        const nextState = isDefined(partialUpdate.state)
          ? (partialUpdate.state as WorkflowRunState)
          : workflowRunToUpdate.state;
        const nextStatus = isDefined(partialUpdate.status)
          ? (partialUpdate.status as WorkflowRunStatus)
          : workflowRunToUpdate.status;
        const expectedStateVersion = workflowRunToUpdate.stateVersion ?? 0;

        const updateResult = await workflowRunRepository.update(
          {
            id: workflowRunId,
            stateVersion: expectedStateVersion,
          },
          {
            ...partialUpdate,
            ...computeWorkflowRunProgressFields({
              state: nextState,
              status: nextStatus,
            }),
            stateVersion: expectedStateVersion + 1,
          },
          undefined,
          undefined,
          ['id'],
        );

        if ((updateResult.affected ?? 0) > 0) {
          if (isDefined(workflowRunToUpdate.candidateId)) {
            const candidateRepository =
              await this.globalWorkspaceOrmManager.getRepository<CandidateProjectIdRecord>(
                workspaceId,
                'candidate',
                { shouldBypassPermissionChecks: true },
              );
            const candidate = await candidateRepository.findOne({
              where: { id: workflowRunToUpdate.candidateId },
            });

            if (isDefined(candidate?.projectId)) {
              this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
                candidate.projectId,
                'journey',
              );
            }
          }

          return;
        }

        await this.delay(WORKFLOW_RUN_STATE_VERSION_RETRY_DELAY_MS);
      }

      throw new WorkflowRunException(
        `Failed to update workflow run ${workflowRunId} after concurrent state conflicts`,
        WorkflowRunExceptionCode.WORKFLOW_RUN_STATE_CONFLICT,
      );
    }, authContext);
  }

  private isTerminalWorkflowRunStatus(status: WorkflowRunStatus): boolean {
    return (
      TERMINAL_WORKFLOW_RUN_STATUSES as readonly WorkflowRunStatus[]
    ).includes(status);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getInitState(
    workflowVersion: WorkflowVersionWorkspaceEntity,
    triggerPayload: object,
    error?: string,
  ): WorkflowRunState | undefined {
    if (
      !isDefined(workflowVersion.trigger) ||
      !isDefined(workflowVersion.steps)
    ) {
      return undefined;
    }

    return {
      flow: {
        trigger: workflowVersion.trigger,
        steps: workflowVersion.steps,
      },
      stepInfos: {
        trigger: { status: StepStatus.NOT_STARTED, result: triggerPayload },
        ...Object.fromEntries(
          workflowVersion.steps.map((step) => [
            step.id,
            { status: StepStatus.NOT_STARTED },
          ]),
        ),
      },
      workflowRunError: error,
    };
  }

  private markRunningStepsAsFailed({
    stepInfosToUpdate,
  }: {
    stepInfosToUpdate: Record<string, WorkflowRunStepInfo>;
  }) {
    return Object.entries(stepInfosToUpdate ?? {})
      .map(([stepId, step]) => {
        if (
          step.status === StepStatus.RUNNING ||
          step.status === StepStatus.PENDING
        ) {
          return {
            [stepId]: {
              ...step,
              status: StepStatus.FAILED,
              error: 'Workflow has been ended before this step was completed',
            },
          };
        }

        return {
          [stepId]: step,
        };
      })
      .reduce((acc, current) => {
        return {
          ...acc,
          ...current,
        };
      }, {});
  }
}
