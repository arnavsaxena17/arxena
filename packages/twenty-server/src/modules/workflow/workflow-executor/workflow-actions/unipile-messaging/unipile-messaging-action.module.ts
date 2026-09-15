import { Module } from '@nestjs/common';

import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';
import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { CommentOnLinkedinPostWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/comment-on-linkedin-post.workflow-action';
import { FetchLinkedinActivityWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/fetch-linkedin-activity.workflow-action';
import { FollowLinkedinProfileWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/follow-linkedin-profile.workflow-action';
import { LikeLinkedinPostWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/like-linkedin-post.workflow-action';
import { SendLinkedinConnectionRequestWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-connection-request.workflow-action';
import { SendLinkedinInmailWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-inmail.workflow-action';
import { SendLinkedinMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-message.workflow-action';
import { SendLinkedinVoiceNoteWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-linkedin-voice-note.workflow-action';
import { SendWhatsappMessageWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/send-whatsapp-message.workflow-action';
import { ViewLinkedinProfileWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/unipile-messaging/view-linkedin-profile.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule, OutreachCommandModule],
  providers: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    FetchLinkedinActivityWorkflowAction,
    CommentOnLinkedinPostWorkflowAction,
    SendLinkedinVoiceNoteWorkflowAction,
    ViewLinkedinProfileWorkflowAction,
    FollowLinkedinProfileWorkflowAction,
    LikeLinkedinPostWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
  exports: [
    SendLinkedinConnectionRequestWorkflowAction,
    SendLinkedinInmailWorkflowAction,
    SendLinkedinMessageWorkflowAction,
    FetchLinkedinActivityWorkflowAction,
    CommentOnLinkedinPostWorkflowAction,
    SendLinkedinVoiceNoteWorkflowAction,
    ViewLinkedinProfileWorkflowAction,
    FollowLinkedinProfileWorkflowAction,
    LikeLinkedinPostWorkflowAction,
    SendWhatsappMessageWorkflowAction,
  ],
})
export class UnipileMessagingActionModule {}
