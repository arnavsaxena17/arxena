import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared';

import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { ActorMetadata } from 'src/engine/metadata-modules/field-metadata/composite-types/actor.composite-type';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { workflowHasRunningSteps } from 'src/modules/workflow/common/utils/workflow-has-running-steps.util';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

@Injectable()
export class WorkflowRunnerWorkspaceService {
  private readonly logger = new Logger(WorkflowRunnerWorkspaceService.name);
  constructor(
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly billingUsageService: BillingUsageService,
  ) {}

  async run(
    workspaceId: string,
    workflowVersionId: string,
    payload: object,
    source: ActorMetadata,
  ) {
    const canFeatureBeUsed =
      await this.billingUsageService.canFeatureBeUsed(workspaceId);

    if (!canFeatureBeUsed) {
      this.logger.log(
        'Cannot execute billed function, there is no subscription for this workspace',
      );
    }
    const workflowRunId =
      await this.workflowRunWorkspaceService.createWorkflowRun({
        workflowVersionId,
        createdBy: source,
      });

    await this.messageQueueService.add<RunWorkflowJobData>(
      RUN_WORKFLOW_JOB_NAME,
      {
        workspaceId,
        workflowVersionId,
        payload: payload,
        workflowRunId,
      },
    );

    return { workflowRunId };
  }

  async stopWorkflowRun(workspaceId: string, workflowRunId: string) {
    const workflowRun =
      await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
        workflowRunId,
        workspaceId,
      });

    const stoppableStatuses = [
      WorkflowRunStatus.NOT_STARTED,
      WorkflowRunStatus.RUNNING,
    ];

    if (!stoppableStatuses.includes(workflowRun.status)) {
      return {
        id: workflowRun.id,
        status: workflowRun.status,
      };
    }

    if (!isDefined(workflowRun.state)) {
      await this.workflowRunWorkspaceService.endWorkflowRun({
        workflowRunId,
        workspaceId,
        status: WorkflowRunStatus.STOPPED,
      });

      return {
        id: workflowRun.id,
        status: WorkflowRunStatus.STOPPED,
      };
    }

    const stepInfos = workflowRun.state.stepInfos;
    const steps = workflowRun.state.flow.steps;

    if (workflowHasRunningSteps({ stepInfos, steps })) {
      await this.workflowRunWorkspaceService.updateWorkflowRun({
        workflowRunId,
        workspaceId,
        partialUpdate: {
          status: WorkflowRunStatus.STOPPING,
        },
      });

      return {
        id: workflowRun.id,
        status: WorkflowRunStatus.STOPPING,
      };
    }

    await this.workflowRunWorkspaceService.endWorkflowRun({
      workflowRunId,
      workspaceId,
      status: WorkflowRunStatus.STOPPED,
    });

    return {
      id: workflowRun.id,
      status: WorkflowRunStatus.STOPPED,
    };
  }
}
