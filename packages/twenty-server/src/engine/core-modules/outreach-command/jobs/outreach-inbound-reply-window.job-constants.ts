import { type InboundBufferedTurn } from 'src/engine/core-modules/outreach-command/utils/inbound-reply-window.util';

export const OUTREACH_INBOUND_REPLY_WINDOW_JOB_NAME = 'OutreachInboundReplyWindowJob';

export type InboundReplyWindowKind = 'outreach' | 'recruiter';

export type InboundReplyWindowChannel = 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';

export type OutreachInboundReplyWindowJobData = {
  workspaceId: string;
  candidateId: string;
  generation: number;
  apiToken?: string;
  kind?: InboundReplyWindowKind;
  channel?: InboundReplyWindowChannel;
  turns?: InboundBufferedTurn[];
  chatId?: string;
};
