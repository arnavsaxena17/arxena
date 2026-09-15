import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { ViewLinkedinProfileTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/view-linkedin-profile-tool';
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
import { isWorkflowViewLinkedinProfileAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-view-linkedin-profile-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowViewLinkedinProfileActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-view-linkedin-profile-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class ViewLinkedinProfileWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowViewLinkedinProfileActionInput> {
  constructor(
    private readonly viewLinkedinProfileTool: ViewLinkedinProfileTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    gtmUnipilePacingService: OutreachUnipilePacingService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    delayedQueue: MessageQueueService,
  ) {
    super(
      ViewLinkedinProfileWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
      gtmUnipilePacingService,
      delayedQueue,
    );
  }

  protected getTool(): Tool {
    return this.viewLinkedinProfileTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'linkedin';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowViewLinkedinProfileAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a view-linkedin-profile action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowViewLinkedinProfileActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'LINKEDIN_PROFILE_VIEW',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.linkedinProfileId,
      output,
      durationMs,
    });
  }
}
