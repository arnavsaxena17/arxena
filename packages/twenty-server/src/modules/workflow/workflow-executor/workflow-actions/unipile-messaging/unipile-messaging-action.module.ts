import { Module } from '@nestjs/common';

import { GtmCommandModule } from 'src/engine/core-modules/gtm-command/gtm-command.module';
import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { SendLinkedinConnectionRequestWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-connection-request.workflow-action';
import { SendLinkedinInmailWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-inmail.workflow-action';
import { SendLinkedinMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-message.workflow-action';
import { SendWhatsappMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-whatsapp-message.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule, GtmCommandModule],
  providers: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
  exports: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
})
export class UnipileMessagingActionModule {}
