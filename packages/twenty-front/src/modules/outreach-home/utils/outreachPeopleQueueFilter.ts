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
      // Chip "All" is totalEnrolled — show Candidate rows with CRM stage / runs.
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

// Discovery-only projects have no Candidate rows yet — fall back to Redis list.
export const resolveOutreachPeopleQueueRows = (
  people: OutreachPersonRow[],
  filter: OutreachPeopleQueueFilter,
): OutreachPersonRow[] => {
  const matched = people.filter((person) =>
    matchesOutreachPeopleQueueFilter(person, filter),
  );

  if (filter === 'all' && matched.length === 0 && people.length > 0) {
    return people;
  }

  return matched;
};
