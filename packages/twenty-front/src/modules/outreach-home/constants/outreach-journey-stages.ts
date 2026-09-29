// Happy-path order for Journey timeline. Branches (email, deferred) and
// terminals sit after the LinkedIn accept → follow-up → reply spine.
// FORM / HITL is a Next-step overlay, not a stage.
// COMMENTED is inserted between QUEUED and CONNECTION_SENT when the
// Candidate Sequencer has commentBeforeConnect (or the candidate already
// stamped COMMENTED). INMAIL_SENT is inserted between CONNECTION_SENT and
// EMAIL_SENT when inmailEnabled (or the candidate already stamped INMAIL_SENT).
export const OUTREACH_JOURNEY_TIMELINE_BASE_STAGES = [
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

export const OUTREACH_JOURNEY_COMMENTED_TIMELINE_STAGE = {
  id: 'COMMENTED',
  label: 'Commented',
} as const;

export const OUTREACH_JOURNEY_INMAIL_SENT_TIMELINE_STAGE = {
  id: 'INMAIL_SENT',
  label: 'InMail sent',
} as const;

// Default export keeps connect-first order; use getOutreachJourneyTimelineStages
// when the active sequencer may include comment-before-connect / InMail.
export const OUTREACH_JOURNEY_TIMELINE_STAGES =
  OUTREACH_JOURNEY_TIMELINE_BASE_STAGES;

export type OutreachJourneyTimelineStageId =
  | (typeof OUTREACH_JOURNEY_TIMELINE_BASE_STAGES)[number]['id']
  | typeof OUTREACH_JOURNEY_COMMENTED_TIMELINE_STAGE.id
  | typeof OUTREACH_JOURNEY_INMAIL_SENT_TIMELINE_STAGE.id;

export type OutreachJourneyTimelineStage = {
  id: OutreachJourneyTimelineStageId;
  label: string;
};

export const getOutreachJourneyTimelineStages = ({
  includeCommentedWarmup = false,
  includeInmailSent = false,
}: {
  includeCommentedWarmup?: boolean;
  includeInmailSent?: boolean;
} = {}): OutreachJourneyTimelineStage[] => {
  if (!includeCommentedWarmup && !includeInmailSent) {
    return [...OUTREACH_JOURNEY_TIMELINE_BASE_STAGES];
  }

  const stages: OutreachJourneyTimelineStage[] = [];

  for (const timelineStage of OUTREACH_JOURNEY_TIMELINE_BASE_STAGES) {
    stages.push(timelineStage);

    if (includeCommentedWarmup && timelineStage.id === 'QUEUED') {
      stages.push(OUTREACH_JOURNEY_COMMENTED_TIMELINE_STAGE);
    }

    if (includeInmailSent && timelineStage.id === 'CONNECTION_SENT') {
      stages.push(OUTREACH_JOURNEY_INMAIL_SENT_TIMELINE_STAGE);
    }
  }

  return stages;
};

export const shouldIncludeCommentedWarmupInJourneyTimeline = ({
  commentBeforeConnect,
  outreachSequenceStage,
  stageHistory,
}: {
  commentBeforeConnect?: boolean;
  outreachSequenceStage?: string | null;
  stageHistory?: Array<{ stage: string }> | null;
}): boolean => {
  if (commentBeforeConnect === true) {
    return true;
  }

  if ((outreachSequenceStage ?? '').toUpperCase() === 'COMMENTED') {
    return true;
  }

  return (stageHistory ?? []).some(
    (historyEntry) => historyEntry.stage.toUpperCase() === 'COMMENTED',
  );
};

export const shouldIncludeInmailSentInJourneyTimeline = ({
  inmailEnabled,
  outreachSequenceStage,
  stageHistory,
}: {
  inmailEnabled?: boolean;
  outreachSequenceStage?: string | null;
  stageHistory?: Array<{ stage: string }> | null;
}): boolean => {
  if (inmailEnabled === true) {
    return true;
  }

  if ((outreachSequenceStage ?? '').toUpperCase() === 'INMAIL_SENT') {
    return true;
  }

  return (stageHistory ?? []).some(
    (historyEntry) => historyEntry.stage.toUpperCase() === 'INMAIL_SENT',
  );
};
