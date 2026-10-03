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
    case 'needs_approval':
      return person.needsApproval === true;
    case 'workflow_failed':
      return person.workflowRunStatus === 'FAILED';
    case 'awaiting_reply':
      return AWAITING_REPLY_STAGES.has(person.stage);
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
      return person.stage === filter;
  }
};
