import { z } from 'zod';
import { workflowAiAgentActionSchema } from './ai-agent-action-schema';
import { workflowCodeActionSchema } from './code-action-schema';
import { workflowCreateCalendarEventActionSchema } from './create-calendar-event-action-schema';
import { workflowCreateRecordActionSchema } from './create-record-action-schema';
import { workflowDeleteRecordActionSchema } from './delete-record-action-schema';
import { workflowDraftEmailActionSchema } from './draft-email-action-schema';
import { workflowEmptyActionSchema } from './empty-action-schema';
import { workflowFilterActionSchema } from './filter-action-schema';
import { workflowFindRecordsActionSchema } from './find-records-action-schema';
import { workflowFormActionSchema } from './form-action-schema';
import { workflowHttpRequestActionSchema } from './http-request-action-schema';
import { workflowIfElseActionSchema } from './if-else-action-schema';
import { workflowIteratorActionSchema } from './iterator-action-schema';
import { workflowLogicFunctionActionSchema } from './logic-function-action-schema';
import { workflowPickRecordActionSchema } from './pick-record-action-schema';
import { workflowSendEmailActionSchema } from './send-email-action-schema';
import { workflowCommentOnLinkedinPostActionSchema } from './comment-on-linkedin-post-action-schema';
import { workflowFetchLinkedinActivityActionSchema } from './fetch-linkedin-activity-action-schema';
import { workflowFollowLinkedinProfileActionSchema } from './follow-linkedin-profile-action-schema';
import { workflowLikeLinkedinPostActionSchema } from './like-linkedin-post-action-schema';
import { workflowSendLinkedinConnectionRequestActionSchema } from './send-linkedin-connection-request-action-schema';
import { workflowSendLinkedinInmailActionSchema } from './send-linkedin-inmail-action-schema';
import { workflowSendLinkedinMessageActionSchema } from './send-linkedin-message-action-schema';
import { workflowSendLinkedinVoiceNoteActionSchema } from './send-linkedin-voice-note-action-schema';
import { workflowSendWhatsappMessageActionSchema } from './send-whatsapp-message-action-schema';
import { workflowUpdateRecordActionSchema } from './update-record-action-schema';
import { workflowUpsertRecordActionSchema } from './upsert-record-action-schema';
import { workflowViewLinkedinProfileActionSchema } from './view-linkedin-profile-action-schema';
import { workflowDelayActionSchema } from './workflow-delay-action-schema';

export const workflowActionSchema = z.discriminatedUnion('type', [
  workflowCodeActionSchema,
  workflowLogicFunctionActionSchema,
  workflowSendEmailActionSchema,
  workflowDraftEmailActionSchema,
  workflowCreateCalendarEventActionSchema,
  workflowCreateRecordActionSchema,
  workflowUpdateRecordActionSchema,
  workflowDeleteRecordActionSchema,
  workflowUpsertRecordActionSchema,
  workflowFindRecordsActionSchema,
  workflowPickRecordActionSchema,
  workflowFormActionSchema,
  workflowHttpRequestActionSchema,
  workflowSendLinkedinConnectionRequestActionSchema,
  workflowSendLinkedinInmailActionSchema,
  workflowSendLinkedinMessageActionSchema,
  workflowFetchLinkedinActivityActionSchema,
  workflowCommentOnLinkedinPostActionSchema,
  workflowSendLinkedinVoiceNoteActionSchema,
  workflowViewLinkedinProfileActionSchema,
  workflowFollowLinkedinProfileActionSchema,
  workflowLikeLinkedinPostActionSchema,
  workflowSendWhatsappMessageActionSchema,
  workflowAiAgentActionSchema,
  workflowFilterActionSchema,
  workflowIfElseActionSchema,
  workflowIteratorActionSchema,
  workflowDelayActionSchema,
  workflowEmptyActionSchema,
]);
