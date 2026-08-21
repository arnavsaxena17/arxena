import { type InboundBufferedTurn } from 'src/engine/core-modules/gtm-command/utils/inbound-reply-window.util';

export const GTM_INBOUND_REPLY_WINDOW_JOB_NAME = 'GtmInboundReplyWindowJob';

export type InboundReplyWindowKind = 'gtm' | 'recruiter';

export type InboundReplyWindowChannel = 'LINKEDIN' | 'WHATSAPP' | 'EMAIL';

export type GtmInboundReplyWindowJobData = {
  workspaceId: string;
  candidateId: string;
  generation: number;
  apiToken?: string;
  kind?: InboundReplyWindowKind;
  channel?: InboundReplyWindowChannel;
  turns?: InboundBufferedTurn[];
  chatId?: string;
};
