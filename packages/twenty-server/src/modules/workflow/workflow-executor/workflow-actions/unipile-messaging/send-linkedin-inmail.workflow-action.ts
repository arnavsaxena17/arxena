import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { SendLinkedinInmailTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-inmail-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { GtmUnipilePacingService } from 'src/engine/core-modules/gtm-command/services/gtm-unipile-pacing.service';
import { GtmOutreachMessagePersistService } from 'src/engine/core-modules/gtm-command/services/gtm-outreach-message-persist.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { isWorkflowSendLinkedinInmailAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-send-linkedin-inmail-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowSendLinkedinInmailActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-send-linkedin-inmail-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class SendLinkedinInmailWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowSendLinkedinInmailActionInput> {
  constructor(
    private readonly sendLinkedinInmailTool: SendLinkedinInmailTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    gtmUnipilePacingService: GtmUnipilePacingService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    delayedQueue: MessageQueueService,
    gtmOutreachMessagePersistService: GtmOutreachMessagePersistService,
  ) {
    super(
      SendLinkedinInmailWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
      gtmUnipilePacingService,
      delayedQueue,
      gtmOutreachMessagePersistService,
    );
  }

  protected override getPacingChannel() {
    return 'message' as const;
  }

  protected override getTranscriptChannel() {
    return 'LINKEDIN' as const;
  }

  protected getTool(): Tool {
    return this.sendLinkedinInmailTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'linkedin';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowSendLinkedinInmailAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a send-linkedin-inmail action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowSendLinkedinInmailActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'LINKEDIN_INMAIL',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.linkedinProfileId,
      subject: input.subject,
      body: input.body,
      output,
      durationMs,
    });
  }
}
