import { Module } from '@nestjs/common';

import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';
import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { CommentOnLinkedinPostWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/comment-on-linkedin-post.workflow-action';
import { FetchLinkedinActivityWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/fetch-linkedin-activity.workflow-action';
import { SendLinkedinConnectionRequestWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-connection-request.workflow-action';
import { SendLinkedinInmailWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-inmail.workflow-action';
import { SendLinkedinMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-message.workflow-action';
import { SendWhatsappMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-whatsapp-message.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule, OutreachCommandModule],
  providers: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    FetchLinkedinActivityWorkflowAction,
    CommentOnLinkedinPostWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
  exports: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    FetchLinkedinActivityWorkflowAction,
    CommentOnLinkedinPostWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
})
export class UnipileMessagingActionModule {}
