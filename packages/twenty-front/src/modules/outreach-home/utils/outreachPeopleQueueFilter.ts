import { isDefined } from 'twenty-shared/utils';

import { type OutreachPersonRow } from '@/outreach-home/types/outreach-home.types';

export const OUTREACH_PEOPLE_QUEUE_FILTERS = [
  { id: 'QUEUED', label: 'To send' },
  { id: 'CONNECTION_SENT', label: 'Connect sent' },
  { id: 'awaiting_reply', label: 'Awaiting reply' },
  { id: 'needs_approval', label: 'Needs approval' },
  { id: 'workflow_failed', label: 'Workflow failed' },
  { id: 'intent', label: 'Intent' },
  { id: 'follow_up_due', label: 'Follow-up due' },
  { id: 'meeting_booked', label: 'Meeting booked' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'snoozed', label: 'Snoozed' },
  { id: 'STOPPED', label: 'Stopped' },
  // Redis discovery rows (no Candidate yet) — not counted in journey chips.
  { id: 'not_enrolled', label: 'Not enrolled' },
  // Enrolled only — Candidate.outreachSequenceStage + workflow run progress.
  { id: 'enrolled', label: 'Enrolled' },
] as const;

export type OutreachPeopleQueueFilter =
  | (typeof OUTREACH_PEOPLE_QUEUE_FILTERS)[number]['id']
  | 'all';

const FOLLOW_UP_DUE_MS = 7 * 24 * 60 * 60 * 1000;

const AWAITING_REPLY_STAGES = new Set([
  'CONNECTION_ACCEPTED',
  'FOLLOW_UP_1',
  'FOLLOW_UP_2',
  'FOLLOW_UP_3',
  'WAITING_REPLY',
]);

const isFollowUpDue = (resumeAt: string | null | undefined): boolean => {
  if (!isDefined(resumeAt)) {
    return false;
  }

  const resumeMs = new Date(resumeAt).getTime();

  return Number.isFinite(resumeMs) && resumeMs <= Date.now() + FOLLOW_UP_DUE_MS;
};

export const matchesOutreachPeopleQueueFilter = (
  person: OutreachPersonRow,
  filter: OutreachPeopleQueueFilter,
): boolean => {
  switch (filter) {
    case 'all':
      return true;
    case 'enrolled':
      return isDefined(person.candidateId);
    case 'not_enrolled':
      return !isDefined(person.candidateId);
    case 'needs_approval':
      return person.needsApproval === true;
    case 'workflow_failed':
      return person.workflowRunStatus === 'FAILED';
    case 'awaiting_reply':
      // Journey chips are enrolled-only; Redis discovery defaults to QUEUED.
      return (
        isDefined(person.candidateId) && AWAITING_REPLY_STAGES.has(person.stage)
      );
    case 'intent':
      return person.outreachConversationStage === 'INTENT';
    case 'follow_up_due':
      return isFollowUpDue(person.outreachResumeAt);
    case 'meeting_booked':
      return person.outreachConversationStage === 'MEETING_BOOKED';
    case 'not_interested':
      return person.outreachConversationStage === 'NOT_INTERESTED';
    case 'snoozed':
      return person.outreachConversationStage === 'SNOOZED';
    default:
      return isDefined(person.candidateId) && person.stage === filter;
  }
};

// All = full working set; enrolled (CRM stage) float to the top so progress
// is not buried under Redis discovery rows that stay Queued.
export const resolveOutreachPeopleQueueRows = (
  people: OutreachPersonRow[],
  filter: OutreachPeopleQueueFilter,
): OutreachPersonRow[] => {
  const matched = people.filter((person) =>
    matchesOutreachPeopleQueueFilter(person, filter),
  );

  if (filter !== 'all') {
    return matched;
  }

  return [...matched].sort((left, right) => {
    const leftEnrolled = isDefined(left.candidateId) ? 0 : 1;
    const rightEnrolled = isDefined(right.candidateId) ? 0 : 1;

    return leftEnrolled - rightEnrolled;
  });
};
