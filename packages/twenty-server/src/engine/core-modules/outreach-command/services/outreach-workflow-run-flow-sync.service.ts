import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';
import { type ObjectLiteral } from 'typeorm';

import {
  readProjectExperimentConfig,
  type OutreachExperimentConfig,
  type OutreachExperimentWorkflowBinding,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { isOutreachSequencerWorkflow } from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { OutreachWorkflowRunRepairService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-repair.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import {
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { getRunnableStepIds } from 'src/modules/workflow/workflow-runner/utils/get-runnable-step-ids.util';
import { mergeWorkflowRunFlowFromVersion } from 'src/modules/workflow/workflow-runner/utils/merge-workflow-run-flow-from-version.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type CandidateExperimentRecord = ObjectLiteral & {
  id: string;
  projectId?: string | null;
  experimentVariant?: string | null;
};

type ProjectExperimentRecord = ObjectLiteral & {
  id: string;
  outreachWorkflowId?: string | null;
  outreachConfig?: unknown;
  experimentConfig?: string | null;
};

type WorkflowVersionExperimentRecord = ObjectLiteral & {
  id: string;
  status: WorkflowVersionStatus;
  workflowId: string;
};

export type SyncOutreachWorkflowRunFlowResult = {
  synced: boolean;
  workflowRunId: string;
  previousWorkflowVersionId?: string;
  nextWorkflowVersionId?: string;
  resetStepIds?: string[];
  repairedStaleFormAfterSend?: boolean;
  kicked?: boolean;
};

@Injectable()
export class OutreachWorkflowRunFlowSyncService {
  private readonly logger = new Logger(OutreachWorkflowRunFlowSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly outreachWorkflowRunRepairService: OutreachWorkflowRunRepairService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  async syncRunToLatestPublishedVersion({
    workspaceId,
    workflowRunId,
    projectId,
  }: {
    workspaceId: string;
    workflowRunId: string;
    projectId: string;
  }): Promise<SyncOutreachWorkflowRunFlowResult> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRun =
          await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
            workflowRunId,
            workspaceId,
          });

        if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
          return { synced: false, workflowRunId };
        }

        const isSequencerWorkflow = await this.isOutreachSequencerWorkflowRun({
          workspaceId,
          projectId,
          workflowRun,
        });

        if (!isSequencerWorkflow) {
          return { synced: false, workflowRunId };
        }

        const targetVersionId = await this.resolveTargetWorkflowVersionId({
          workspaceId,
          projectId,
          workflowRun,
        });

        if (!isNonEmptyString(targetVersionId)) {
          return { synced: false, workflowRunId };
        }

        if (workflowRun.workflowVersionId === targetVersionId) {
          return { synced: false, workflowRunId };
        }

        const workflowVersion =
          await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
            workspaceId,
            workflowVersionId: targetVersionId,
          });

        if (
          !isDefined(workflowVersion.trigger) ||
          !isDefined(workflowVersion.steps)
        ) {
          this.logger.warn(
            `Skipping flow sync for run ${workflowRunId}: target version ${targetVersionId} has no trigger or steps`,
          );

          return { synced: false, workflowRunId };
        }

        const mergeResult = mergeWorkflowRunFlowFromVersion({
          currentState: workflowRun.state,
          nextTrigger: workflowVersion.trigger,
          nextSteps: workflowVersion.steps,
        });

        await this.workflowRunWorkspaceService.updateWorkflowRun({
          workflowRunId,
          workspaceId,
          partialUpdate: {
            workflowVersionId: targetVersionId,
            state: mergeResult.state,
          },
        });

        this.logger.log(
          `Synced workflow run ${workflowRunId} from version ${workflowRun.workflowVersionId} to ${targetVersionId}` +
            (mergeResult.resetStepIds.length > 0
              ? `; reset steps: ${mergeResult.resetStepIds.join(', ')}`
              : ''),
        );

        let repairedStaleFormAfterSend = false;

        try {
          const repairResult =
            await this.outreachWorkflowRunRepairService.repairStaleFormAfterSend(
              {
                workspaceId,
                workflowRunId,
              },
            );
          repairedStaleFormAfterSend = repairResult.repaired;
        } catch (error) {
          this.logger.warn(
            `Failed stale FORM-after-send repair after sync for run ${workflowRunId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        return {
          synced: true,
          workflowRunId,
          previousWorkflowVersionId: workflowRun.workflowVersionId,
          nextWorkflowVersionId: targetVersionId,
          resetStepIds: mergeResult.resetStepIds,
          repairedStaleFormAfterSend,
        };
      },
      authContext,
    );
  }

  // Same-version content refresh: Active AI_AGENT prompt edits keep the version
  // id, so syncRunToLatestPublishedVersion never fires. Merge run flow against
  // live steps, reset draft→pending FORM when the prompt fingerprint changed,
  // then kick so HITL re-parks with a regenerated message.
  async syncRunToLiveVersionContent({
    workspaceId,
    workflowRunId,
    changedStepIds,
  }: {
    workspaceId: string;
    workflowRunId: string;
    changedStepIds: string[];
  }): Promise<SyncOutreachWorkflowRunFlowResult> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRun =
          await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
            workflowRunId,
            workspaceId,
          });

        if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
          return { synced: false, workflowRunId };
        }

        if (!isDefined(workflowRun.state?.flow?.steps)) {
          return { synced: false, workflowRunId };
        }

        const workflowVersion =
          await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
            workspaceId,
            workflowVersionId: workflowRun.workflowVersionId,
          });

        if (
          !isDefined(workflowVersion.trigger) ||
          !isDefined(workflowVersion.steps)
        ) {
          return { synced: false, workflowRunId };
        }

        const hasStaleChangedStep = changedStepIds.some((stepId) => {
          const runStep = workflowRun.state?.flow?.steps?.find(
            (step) => step.id === stepId,
          );
          const versionStep = workflowVersion.steps?.find(
            (step) => step.id === stepId,
          );

          if (!isDefined(runStep) || !isDefined(versionStep)) {
            return false;
          }

          if (versionStep.type !== WorkflowActionType.AI_AGENT) {
            return false;
          }

          return (
            getStepInputFingerprint(runStep) !==
            getStepInputFingerprint(versionStep)
          );
        });

        if (!hasStaleChangedStep) {
          return { synced: false, workflowRunId };
        }

        const mergeResult = mergeWorkflowRunFlowFromVersion({
          currentState: workflowRun.state,
          nextTrigger: workflowVersion.trigger,
          nextSteps: workflowVersion.steps,
        });

        const changedStepWasReset = changedStepIds.some((stepId) =>
          mergeResult.resetStepIds.includes(stepId),
        );
        const changedStepIsRunnableWithoutReset = changedStepIds.some(
          (stepId) => {
            const stepInfo = mergeResult.state.stepInfos?.[stepId];

            return stepInfo?.status === StepStatus.NOT_STARTED;
          },
        );

        await this.workflowRunWorkspaceService.updateWorkflowRun({
          workflowRunId,
          workspaceId,
          partialUpdate: {
            state: mergeResult.state,
          },
        });

        this.logger.log(
          `Synced live content for run ${workflowRunId}` +
            (mergeResult.resetStepIds.length > 0
              ? `; reset steps: ${mergeResult.resetStepIds.join(', ')}`
              : ''),
        );

        if (!changedStepWasReset && !changedStepIsRunnableWithoutReset) {
          return {
            synced: true,
            workflowRunId,
            resetStepIds: mergeResult.resetStepIds,
            kicked: false,
          };
        }

        const freshRun =
          await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
            workflowRunId,
            workspaceId,
          });

        const kicked = await this.kickIdleRunningWorkflowRun({
          workspaceId,
          workflowRun: freshRun,
        });

        return {
          synced: true,
          workflowRunId,
          resetStepIds: mergeResult.resetStepIds,
          kicked,
        };
      },
      authContext,
    );
  }

  async refreshPendingHitlForWorkflowVersion({
    workspaceId,
    workflowVersionId,
    changedStepIds,
  }: {
    workspaceId: string;
    workflowVersionId: string;
    changedStepIds: string[];
  }): Promise<{ syncedRuns: number; kickedRuns: number }> {
    if (changedStepIds.length === 0) {
      return { syncedRuns: 0, kickedRuns: 0 };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const workflowRunRepository =
          await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
            workspaceId,
            'workflowRun',
            { shouldBypassPermissionChecks: true },
          );

        const runs = await workflowRunRepository.find({
          where: {
            workflowVersionId,
            status: WorkflowRunStatus.RUNNING,
          },
        });

        let syncedRuns = 0;
        let kickedRuns = 0;

        for (const run of runs) {
          try {
            const result = await this.syncRunToLiveVersionContent({
              workspaceId,
              workflowRunId: run.id,
              changedStepIds,
            });

            if (result.synced) {
              syncedRuns += 1;
            }

            if (result.kicked) {
              kickedRuns += 1;
            }
          } catch (error) {
            this.logger.warn(
              `Failed live content sync for run ${run.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }

        this.logger.log(
          `refreshPendingHitlForWorkflowVersion ${workflowVersionId}: synced=${syncedRuns} kicked=${kickedRuns} of ${runs.length} running`,
        );

        return { syncedRuns, kickedRuns };
      },
      authContext,
    );
  }

  private async kickIdleRunningWorkflowRun({
    workspaceId,
    workflowRun,
  }: {
    workspaceId: string;
    workflowRun: WorkflowRunWorkspaceEntity;
  }): Promise<boolean> {
    const steps = workflowRun.state?.flow?.steps;

    if (!isDefined(steps) || steps.length === 0) {
      return false;
    }

    const stepInfos = workflowRun.state?.stepInfos ?? {};
    const runnableStepIds = getRunnableStepIds({
      steps,
      stepInfos,
    });

    if (runnableStepIds.length === 0) {
      return false;
    }

    await this.workflowQueue.add<RunWorkflowJobData>(
      RUN_WORKFLOW_JOB_NAME,
      {
        workspaceId,
        workflowRunId: workflowRun.id,
        stepIdsToRetry: runnableStepIds,
      },
      buildRunWorkflowJobOptions(workflowRun.id),
    );

    this.logger.log(
      `Kicked idle workflow run ${workflowRun.id} for steps: ${runnableStepIds.join(', ')}`,
    );

    return true;
  }

  private async resolveTargetWorkflowVersionId({
    workspaceId,
    projectId,
    workflowRun,
  }: {
    workspaceId: string;
    projectId: string;
    workflowRun: WorkflowRunWorkspaceEntity;
  }): Promise<string | null> {
    const workflowRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
        workspaceId,
        'workflow',
        { shouldBypassPermissionChecks: true },
      );
    const workflow = await workflowRepository.findOne({
      where: { id: workflowRun.workflowId },
    });

    if (!isDefined(workflow?.lastPublishedVersionId)) {
      return null;
    }

    const controlVersionId = workflow.lastPublishedVersionId;

    if (!isNonEmptyString(workflowRun.candidateId)) {
      return controlVersionId;
    }

    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidateExperimentRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );
    const candidate = await candidateRepository.findOne({
      where: { id: workflowRun.candidateId },
    });

    if (
      !isDefined(candidate) ||
      candidate.experimentVariant !== 'B' ||
      candidate.projectId !== projectId
    ) {
      return controlVersionId;
    }

    const projectRepository =
      await this.globalWorkspaceOrmManager.getRepository<ProjectExperimentRecord>(
        workspaceId,
        'project',
        { shouldBypassPermissionChecks: true },
      );
    const project = await projectRepository.findOne({
      where: { id: projectId },
    });
    const experimentConfig = readProjectExperimentConfig(project ?? {});

    if (experimentConfig?.status !== 'running') {
      return controlVersionId;
    }

    const binding = this.resolveExperimentBinding({
      experimentConfig,
      workflowId: workflowRun.workflowId,
    });

    if (isNonEmptyString(binding?.versionB)) {
      return binding.versionB;
    }

    const workflowVersionRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionExperimentRecord>(
        workspaceId,
        'workflowVersion',
        { shouldBypassPermissionChecks: true },
      );
    const experimentVersion = await workflowVersionRepository.findOne({
      where: {
        workflowId: workflowRun.workflowId,
        status: WorkflowVersionStatus.EXPERIMENT,
      },
    });

    return experimentVersion?.id ?? controlVersionId;
  }

  private resolveExperimentBinding({
    experimentConfig,
    workflowId,
  }: {
    experimentConfig: OutreachExperimentConfig;
    workflowId: string;
  }): OutreachExperimentWorkflowBinding | null {
    if (
      experimentConfig.workflows?.candidateSequencer?.workflowId === workflowId
    ) {
      return experimentConfig.workflows.candidateSequencer;
    }

    return null;
  }

  private async isOutreachSequencerWorkflowRun({
    workspaceId,
    projectId,
    workflowRun,
  }: {
    workspaceId: string;
    projectId: string;
    workflowRun: WorkflowRunWorkspaceEntity;
  }): Promise<boolean> {
    const workflowRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
        workspaceId,
        'workflow',
        { shouldBypassPermissionChecks: true },
      );
    const workflow = await workflowRepository.findOne({
      where: { id: workflowRun.workflowId },
    });
    const projectRepository =
      await this.globalWorkspaceOrmManager.getRepository<ProjectExperimentRecord>(
        workspaceId,
        'project',
        { shouldBypassPermissionChecks: true },
      );
    const project = await projectRepository.findOne({
      where: { id: projectId },
    });

    return isOutreachSequencerWorkflow({
      workflowId: workflowRun.workflowId,
      workflowName: workflow?.name,
      outreachWorkflowId: project?.outreachWorkflowId,
      outreachConfig: project?.outreachConfig,
      experimentConfig: project?.experimentConfig,
    });
  }
}

const getStepInputFingerprint = (step: {
  settings?: { input?: unknown };
}): string => {
  return JSON.stringify(step.settings?.input ?? {});
};
