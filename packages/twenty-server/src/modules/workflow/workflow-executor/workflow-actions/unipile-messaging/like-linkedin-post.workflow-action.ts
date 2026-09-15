import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { LikeLinkedinPostTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/like-linkedin-post-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { OutreachUnipilePacingService } from 'src/engine/core-modules/outreach-command/services/outreach-unipile-pacing.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { isWorkflowLikeLinkedinPostAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-like-linkedin-post-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowLikeLinkedinPostActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-like-linkedin-post-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class LikeLinkedinPostWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowLikeLinkedinPostActionInput> {
  constructor(
    private readonly likeLinkedinPostTool: LikeLinkedinPostTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    gtmUnipilePacingService: OutreachUnipilePacingService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    delayedQueue: MessageQueueService,
  ) {
    super(
      LikeLinkedinPostWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
      gtmUnipilePacingService,
      delayedQueue,
    );
  }

  protected override getPacingChannel() {
    return 'comment' as const;
  }

  protected getTool(): Tool {
    return this.likeLinkedinPostTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'linkedin';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowLikeLinkedinPostAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a like-linkedin-post action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowLikeLinkedinPostActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'LINKEDIN_POST_LIKE',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.postId,
      body: input.reactionType ?? 'like',
      output,
      durationMs,
    });
  }
}
