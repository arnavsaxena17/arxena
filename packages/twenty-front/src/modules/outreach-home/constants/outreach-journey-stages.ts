// Happy-path order for Journey timeline. Branches (email, deferred) and
// terminals sit after the LinkedIn accept → follow-up → reply spine.
// FORM / HITL is a Next-step overlay, not a stage.
export const OUTREACH_JOURNEY_TIMELINE_STAGES = [
  { id: 'QUEUED', label: 'Queued' },
  { id: 'CONNECTION_SENT', label: 'Connection sent' },
  { id: 'EMAIL_SENT', label: 'Email sent' },
  { id: 'CONNECTION_ACCEPTED', label: 'Connection accepted' },
  { id: 'FOLLOW_UP_1', label: 'Followed up 1' },
  { id: 'FOLLOW_UP_2', label: 'Followed up 2' },
  { id: 'FOLLOW_UP_3', label: 'Followed up 3' },
  { id: 'REPLIED', label: 'Replied' },
  { id: 'WAITING_REPLY', label: 'Waiting for reply' },
  { id: 'MEETING_BOOKED', label: 'Meeting booked' },
  { id: 'FAILED_NO_REPLY', label: 'Failed no reply' },
  { id: 'FAILED_ENRICH', label: 'Failed enrich' },
  { id: 'DEFERRED', label: 'Waiting for slot' },
  { id: 'STOPPED', label: 'Stopped' },
] as const;

export type OutreachJourneyTimelineStageId =
  (typeof OUTREACH_JOURNEY_TIMELINE_STAGES)[number]['id'];
