import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { planStaleFormAfterSendRepairs } from 'src/engine/core-modules/outreach-command/utils/plan-stale-form-after-send-repairs.util';
import { buildWorkflowRunStepDeferralClearPatch } from 'src/engine/core-modules/outreach-command/utils/read-workflow-run-step-pending-fields.util';
import { isOutreachSequencerWorkflow } from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow.workspace-entity';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

export type RepairStaleFormAfterSendResult = {
  repaired: boolean;
  repairedFormStepIds: string[];
  continuedFromSendStepIds: string[];
};

@Injectable()
export class OutreachWorkflowRunRepairService {
  private readonly logger = new Logger(OutreachWorkflowRunRepairService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  async repairStaleFormAfterSend({
    workspaceId,
    workflowRunId,
  }: {
    workspaceId: string;
    workflowRunId: string;
  }): Promise<RepairStaleFormAfterSendResult> {
    const emptyResult: RepairStaleFormAfterSendResult = {
      repaired: false,
      repairedFormStepIds: [],
      continuedFromSendStepIds: [],
    };

    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
      return emptyResult;
    }

    const isSequencerWorkflow = await this.isOutreachSequencerWorkflowRun({
      workspaceId,
      workflowRunId: workflowRun.id,
      workflowId: workflowRun.workflowId,
      candidateId: workflowRun.candidateId,
    });

    if (!isSequencerWorkflow) {
      return emptyResult;
    }

    const plans = planStaleFormAfterSendRepairs(workflowRun.state);

    if (plans.length === 0) {
      return {
        repaired: false,
        repairedFormStepIds: [],
        continuedFromSendStepIds: [],
      };
    }

    const repairedFormStepIds: string[] = [];
    const continuedFromSendStepIds: string[] = [];

    for (const plan of plans) {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId: plan.formStepId,
        stepInfo: {
          ...plan.repairedFormStepInfo,
          ...buildWorkflowRunStepDeferralClearPatch(),
        },
        workspaceId,
        workflowRunId,
      });
      repairedFormStepIds.push(plan.formStepId);

      if (
        isNonEmptyString(plan.continueFromSendStepId) &&
        !continuedFromSendStepIds.includes(plan.continueFromSendStepId)
      ) {
        await this.workflowQueue.add<RunWorkflowJobData>(
          RUN_WORKFLOW_JOB_NAME,
          {
            workspaceId,
            workflowRunId,
            lastExecutedStepId: plan.continueFromSendStepId,
          },
          buildRunWorkflowJobOptions(workflowRunId),
        );
        continuedFromSendStepIds.push(plan.continueFromSendStepId);
      }
    }

    this.logger.log(
      `Repaired stale FORM-after-send on run ${workflowRunId}: forms=${repairedFormStepIds.join(', ')}` +
        (continuedFromSendStepIds.length > 0
          ? `; continuedFrom=${continuedFromSendStepIds.join(', ')}`
          : ''),
    );

    return {
      repaired: true,
      repairedFormStepIds,
      continuedFromSendStepIds,
    };
  }

  async repairStaleFormsAfterSendForRuns({
    workspaceId,
    workflowRunIds,
  }: {
    workspaceId: string;
    workflowRunIds: string[];
  }): Promise<{ repairedRunIds: string[] }> {
    const uniqueRunIds = [
      ...new Set(workflowRunIds.filter((id) => isNonEmptyString(id))),
    ];
    const repairedRunIds: string[] = [];

    for (const workflowRunId of uniqueRunIds) {
      try {
        const result = await this.repairStaleFormAfterSend({
          workspaceId,
          workflowRunId,
        });

        if (result.repaired) {
          repairedRunIds.push(workflowRunId);
        }
      } catch (error) {
        this.logger.warn(
          `Failed stale FORM-after-send repair for run ${workflowRunId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return { repairedRunIds };
  }

  private async isOutreachSequencerWorkflowRun({
    workspaceId,
    workflowId,
    candidateId,
  }: {
    workspaceId: string;
    workflowRunId: string;
    workflowId: string;
    candidateId?: string | null;
  }): Promise<boolean> {
    const workflowRepository =
      await this.globalWorkspaceOrmManager.getRepository<WorkflowWorkspaceEntity>(
        workspaceId,
        'workflow',
        { shouldBypassPermissionChecks: true },
      );
    const workflow = await workflowRepository.findOne({
      where: { id: workflowId },
    });

    let project:
      | (ObjectLiteral & {
          outreachWorkflowId?: string | null;
          outreachConfig?: unknown;
          experimentConfig?: string | null;
        })
      | null = null;

    if (isNonEmptyString(candidateId)) {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<
          ObjectLiteral & { id: string; projectsId?: string | null }
        >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });
      const candidate = await candidateRepository.findOne({
        where: { id: candidateId },
      });

      if (isNonEmptyString(candidate?.projectsId)) {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<
            ObjectLiteral & {
              id: string;
              outreachWorkflowId?: string | null;
              outreachConfig?: unknown;
              experimentConfig?: string | null;
            }
          >(workspaceId, 'project', { shouldBypassPermissionChecks: true });
        project = await projectRepository.findOne({
          where: { id: candidate.projectsId },
        });
      }
    }

    return isOutreachSequencerWorkflow({
      workflowId,
      workflowName: workflow?.name,
      outreachWorkflowId: project?.outreachWorkflowId,
      outreachConfig: project?.outreachConfig,
      experimentConfig: project?.experimentConfig,
    });
  }
}
