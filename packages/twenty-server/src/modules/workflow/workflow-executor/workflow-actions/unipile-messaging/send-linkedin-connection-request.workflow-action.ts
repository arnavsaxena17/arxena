import { Injectable } from '@nestjs/common';

import { MessagingChannel } from 'twenty-shared/arx';
import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { SendLinkedinConnectionRequestTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-connection-request-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { OutreachUnipilePacingService } from 'src/engine/core-modules/outreach-command/services/outreach-unipile-pacing.service';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { isWorkflowSendLinkedinConnectionRequestAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-send-linkedin-connection-request-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowSendLinkedinConnectionRequestActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-send-linkedin-connection-request-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class SendLinkedinConnectionRequestWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowSendLinkedinConnectionRequestActionInput> {
  constructor(
    private readonly sendLinkedinConnectionRequestTool: SendLinkedinConnectionRequestTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    gtmUnipilePacingService: OutreachUnipilePacingService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    delayedQueue: MessageQueueService,
    gtmOutreachMessagePersistService: OutreachMessagePersistService,
  ) {
    super(
      SendLinkedinConnectionRequestWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
      gtmUnipilePacingService,
      delayedQueue,
      gtmOutreachMessagePersistService,
    );
  }

  protected override getPacingChannel() {
    return 'connect' as const;
  }

  // Persist the connection note into chatMessage.messageObj (same as DMs).
  protected override getTranscriptChannel() {
    return 'LINKEDIN' as const;
  }

  protected override getMaterializeEvent() {
    return 'connection_sent' as const;
  }

  protected override getOutboundMessageKind() {
    return 'CONNECT_NOTE';
  }

  protected override getMaterializeMessagingChannel() {
    return MessagingChannel.LINKEDIN_CONNECT;
  }

  protected getTool(): Tool {
    return this.sendLinkedinConnectionRequestTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'linkedin';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowSendLinkedinConnectionRequestAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a send-linkedin-connection-request action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowSendLinkedinConnectionRequestActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'LINKEDIN_CONNECTION_REQUEST',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.linkedinProfileId,
      body: input.message,
      output,
      durationMs,
    });
  }
}
