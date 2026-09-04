import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import {
  readProjectExperimentConfig,
  type OutreachExperimentWorkflowBinding,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { OutreachWorkflowRunRepairService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-repair.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import {
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { mergeWorkflowRunFlowFromVersion } from 'src/modules/workflow/workflow-runner/utils/merge-workflow-run-flow-from-version.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type CandidateExperimentRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
  experimentVariant?: string | null;
};

type ProjectExperimentRecord = ObjectLiteral & {
  id: string;
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
};

@Injectable()
export class OutreachWorkflowRunFlowSyncService {
  private readonly logger = new Logger(OutreachWorkflowRunFlowSyncService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly outreachWorkflowRunRepairService: OutreachWorkflowRunRepairService,
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
            await this.outreachWorkflowRunRepairService.repairStaleFormAfterSend({
              workspaceId,
              workflowRunId,
            });
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
      candidate.projectsId !== projectId
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
    experimentConfig: NonNullable<
      ReturnType<typeof parseOutreachExperimentConfig>
    >;
    workflowId: string;
  }): OutreachExperimentWorkflowBinding | null {
    if (experimentConfig.workflows?.perCandidate?.workflowId === workflowId) {
      return experimentConfig.workflows.perCandidate;
    }

    if (
      experimentConfig.workflows?.candidateUpdated?.workflowId === workflowId
    ) {
      return experimentConfig.workflows.candidateUpdated;
    }

    if (experimentConfig.workflows?.companySearch?.workflowId === workflowId) {
      return experimentConfig.workflows.companySearch;
    }

    return null;
  }
}
