export const GTM_INBOUND_REPLY_WINDOW_JOB_NAME = 'GtmInboundReplyWindowJob';

export type GtmInboundReplyWindowJobData = {
  workspaceId: string;
  candidateId: string;
  generation: number;
  apiToken?: string;
};
