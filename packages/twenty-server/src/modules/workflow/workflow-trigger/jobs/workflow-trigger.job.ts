import { Logger, Scope } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import isEmpty from 'lodash.isempty';
import { FieldActorSource } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { readProjectExperimentConfig } from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowVersionStatus } from 'src/modules/workflow/common/standard-objects/workflow-version.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import { WorkflowRunnerWorkspaceService } from 'src/modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service';
import { WorkflowTriggerExceptionCode } from 'src/modules/workflow/workflow-trigger/exceptions/workflow-trigger.exception';

export type WorkflowTriggerJobData = {
  workspaceId: string;
  workflowId: string;
  payload: object;
};

const DEFAULT_WORKFLOW_NAME = 'Workflow';

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

@Processor({ queueName: MessageQueue.workflowQueue, scope: Scope.REQUEST })
export class WorkflowTriggerJob {
  private readonly logger = new Logger(WorkflowTriggerJob.name);
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowCommonWorkspaceService: WorkflowCommonWorkspaceService,
    private readonly workflowRunnerWorkspaceService: WorkflowRunnerWorkspaceService,
  ) {}

  @Process(WorkflowTriggerJob.name)
  async handle(data: WorkflowTriggerJobData): Promise<void> {
    const authContext = buildSystemAuthContext(data.workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
          data.workspaceId,
          'workflow',
          { shouldBypassPermissionChecks: true },
        );

      const workflow = await workflowRepository.findOneBy({
        id: data.workflowId,
      });

      if (!workflow) {
        this.logger.error(
          `Workflow ${data.workflowId} not found in workspace ${data.workspaceId}`,
          WorkflowTriggerExceptionCode.NOT_FOUND,
        );

        return;
      }

      if (!workflow.lastPublishedVersionId) {
        this.logger.error(
          `Workflow ${data.workflowId} has no published version in workspace ${data.workspaceId}`,
          WorkflowTriggerExceptionCode.INTERNAL_ERROR,
        );

        return;
      }

      const workflowVersionId = await this.resolveWorkflowVersionId({
        workspaceId: data.workspaceId,
        workflowId: data.workflowId,
        controlVersionId: workflow.lastPublishedVersionId,
        payload: data.payload,
      });

      const workflowVersion =
        await this.workflowCommonWorkspaceService.getWorkflowVersionOrFail({
          workspaceId: data.workspaceId,
          workflowVersionId,
        });

      const isRunnable =
        workflowVersion.status === WorkflowVersionStatus.ACTIVE ||
        workflowVersion.status === WorkflowVersionStatus.EXPERIMENT;

      if (!isRunnable) {
        this.logger.error(
          `Workflow version ${workflowVersion?.id} is not runnable in workspace ${data.workspaceId}`,
          WorkflowTriggerExceptionCode.INTERNAL_ERROR,
        );

        return;
      }

      await this.workflowRunnerWorkspaceService.run({
        workspaceId: data.workspaceId,
        workflowVersionId,
        payload: data.payload,
        source: {
          source: FieldActorSource.WORKFLOW,
          name:
            isDefined(workflow.name) && !isEmpty(workflow.name)
              ? workflow.name
              : DEFAULT_WORKFLOW_NAME,
          context: {},
          workspaceMemberId: null,
        },
      });
    }, authContext);
  }

  /**
   * If the project has a running experiment and the candidate is variant B,
   * run the EXPERIMENT version when configured; otherwise the ACTIVE control.
   */
  private async resolveWorkflowVersionId({
    workspaceId,
    workflowId,
    controlVersionId,
    payload,
  }: {
    workspaceId: string;
    workflowId: string;
    controlVersionId: string;
    payload: object;
  }): Promise<string> {
    try {
      const after =
        (payload as { properties?: { after?: Record<string, unknown> } })
          ?.properties?.after ??
        (payload as { after?: Record<string, unknown> }).after ??
        (payload as Record<string, unknown>);

      const candidateId =
        typeof after?.id === 'string'
          ? after.id
          : typeof (after as { candidateId?: unknown })?.candidateId ===
              'string'
            ? ((after as { candidateId: string }).candidateId)
            : null;

      if (!isNonEmptyString(candidateId)) {
        return controlVersionId;
      }

      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<CandidateExperimentRecord>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );
      const candidate = await candidateRepository.findOne({
        where: { id: candidateId },
      });

      if (
        !isDefined(candidate) ||
        candidate.experimentVariant !== 'B' ||
        !isNonEmptyString(candidate.projectsId)
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
        where: { id: candidate.projectsId },
      });
      const experimentConfig = readProjectExperimentConfig(project ?? {});

      if (experimentConfig?.status !== 'running') {
        return controlVersionId;
      }

      const binding =
        experimentConfig.workflows?.perCandidate?.workflowId === workflowId
          ? experimentConfig.workflows.perCandidate
          : experimentConfig.workflows?.candidateUpdated?.workflowId ===
              workflowId
            ? experimentConfig.workflows.candidateUpdated
            : experimentConfig.workflows?.companySearch?.workflowId ===
                workflowId
              ? experimentConfig.workflows.companySearch
              : null;

      if (isNonEmptyString(binding?.versionB)) {
        return binding.versionB;
      }

      // Fall back to the single EXPERIMENT version on this workflow.
      const workflowVersionRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionExperimentRecord>(
          workspaceId,
          'workflowVersion',
          { shouldBypassPermissionChecks: true },
        );
      const experimentVersion = await workflowVersionRepository.findOne({
        where: {
          workflowId,
          status: WorkflowVersionStatus.EXPERIMENT,
        },
      });

      return experimentVersion?.id ?? controlVersionId;
    } catch (error) {
      this.logger.warn(
        `Experiment dispatch fell back to control version: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return controlVersionId;
    }
  }
}
