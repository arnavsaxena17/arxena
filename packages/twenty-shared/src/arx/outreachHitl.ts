// WhatsApp FORM notify titles for Candidate Sequencer HITL steps.
export const OUTREACH_HITL_CONTEXT_TEMPLATES = {
  firstLinkedInMessage: 'Review first LinkedIn message',
  linkedInFollowUp: (followUpIndex: number) =>
    `Review LinkedIn follow-up ${followUpIndex}`,
  inboundSalesReply: 'Review inbound sales reply',
  postReplyFollowUp1: 'Review post-reply follow-up 1',
  postReplyFollowUp2Last: 'Review post-reply follow-up 2 (last)',
  linkedInConnectionNote: 'Review LinkedIn connection note',
  fallbackEmail: 'Review fallback email',
  meetingReminder: 'Review meeting reminder',
  noShowPing: 'Review no-show ping',
  rescheduleOffer: 'Review reschedule offer',
} as const;
