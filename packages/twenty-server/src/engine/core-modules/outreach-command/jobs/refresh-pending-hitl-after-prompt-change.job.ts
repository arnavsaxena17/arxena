import { Injectable, Logger } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { OutreachWorkflowRunFlowSyncService } from 'src/engine/core-modules/outreach-command/services/outreach-workflow-run-flow-sync.service';

export const REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_JOB_NAME =
  'RefreshPendingHitlAfterPromptChangeJob';

export const REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_DELAY_MS = 3_000;

export type RefreshPendingHitlAfterPromptChangeJobData = {
  workspaceId: string;
  workflowVersionId: string;
  changedStepIds: string[];
};

@Injectable()
@Processor(MessageQueue.workflowQueue)
export class RefreshPendingHitlAfterPromptChangeJob {
  private readonly logger = new Logger(
    RefreshPendingHitlAfterPromptChangeJob.name,
  );

  constructor(
    private readonly outreachWorkflowRunFlowSyncService: OutreachWorkflowRunFlowSyncService,
  ) {}

  @Process(REFRESH_PENDING_HITL_AFTER_PROMPT_CHANGE_JOB_NAME)
  async handle(
    jobData: RefreshPendingHitlAfterPromptChangeJobData,
  ): Promise<void> {
    const { workspaceId, workflowVersionId, changedStepIds } = jobData;

    this.logger.log(
      `Refreshing pending HITL for version ${workflowVersionId} steps=${changedStepIds.join(',')}`,
    );

    await this.outreachWorkflowRunFlowSyncService.refreshPendingHitlForWorkflowVersion(
      {
        workspaceId,
        workflowVersionId,
        changedStepIds,
      },
    );
  }
}
