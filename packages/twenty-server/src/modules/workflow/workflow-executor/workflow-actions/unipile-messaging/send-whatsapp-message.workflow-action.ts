import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { SendWhatsappMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-whatsapp-message-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { isWorkflowSendWhatsappMessageAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/guards/is-workflow-send-whatsapp-message-action.guard';
import { type UnipileMessagingAccountType } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/unipile-messaging-account-type.type';
import { type WorkflowSendWhatsappMessageActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/types/workflow-send-whatsapp-message-action-input.type';
import { UnipileMessagingWorkflowActionBase } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/unipile-messaging-workflow-action.base';
import { buildUnipileMessagingStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/utils/build-unipile-messaging-step-log.util';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class SendWhatsappMessageWorkflowAction extends UnipileMessagingWorkflowActionBase<WorkflowSendWhatsappMessageActionInput> {
  constructor(
    private readonly sendWhatsappMessageTool: SendWhatsappMessageTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
    globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(
      SendWhatsappMessageWorkflowAction.name,
      workflowRunStepLogService,
      globalWorkspaceOrmManager,
    );
  }

  protected getTool(): Tool {
    return this.sendWhatsappMessageTool;
  }

  protected getAccountType(): UnipileMessagingAccountType {
    return 'whatsapp';
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowSendWhatsappMessageAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a send-whatsapp-message action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowSendWhatsappMessageActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildUnipileMessagingStepLog({
      channel: 'WHATSAPP_MESSAGE',
      workspaceMemberId: input.workspaceMemberId,
      unipileAccountId: input.unipileAccountId,
      recipient: input.phone,
      body: input.body,
      output,
      durationMs,
    });
  }
}
