import { type OutreachStage } from '@/outreach-home/types/outreach-home.types';

export const OUTREACH_STAGE_LABELS: Record<string, string> = {
  QUEUED: 'Queued',
  NEEDS_CONNECTION: 'Needs connection',
  CONNECTION_SENT: 'Connection sent',
  CONNECTION_ACCEPTED: 'Connection accepted',
  CONNECTION_IGNORED: 'Connection ignored',
  PROFILE_CHECKED: 'Profile checked',
  WARM_PATH: 'Warm path',
  COMMENTED: 'Commented',
  EMAIL_ENRICHING: 'Enriching email',
  EMAIL_SENT: 'Email sent',
  INMAIL_SENT: 'InMail sent',
  WHATSAPP_SENT: 'WhatsApp sent',
  FOLLOW_UP_1: 'Followed up 1',
  FOLLOWED_UP: 'Followed up 1',
  FOLLOWED_UP_1: 'Followed up 1',
  FOLLOW_UP_2: 'Followed up 2',
  FOLLOWED_UP_2: 'Followed up 2',
  FOLLOW_UP_3: 'Followed up 3',
  FOLLOWED_UP_3: 'Followed up 3',
  DEFERRED: 'Waiting for slot',
  STOPPED: 'Stopped',
  REPLIED: 'Replied',
  NEGOTIATING: 'Negotiating',
  MEETING_BOOKED: 'Meeting booked',
  BOOKED: 'Meeting booked',
  FAILED_ENRICH: 'Failed enrich',
  FAILED_NO_REPLY: 'Failed no reply',
  WAITING_REPLY: 'Waiting for reply',
};

export const WORKFLOW_RUN_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ENQUEUED: 'Enqueued',
  STOPPING: 'Stopping',
  STOPPED: 'Stopped',
};

export const OUTREACH_STAGES: Array<{
  id: OutreachStage;
  label: string;
  description: string;
}> = [
  {
    id: 'QUEUED',
    label: 'Queued',
    description: 'Waiting to enter the outreach sequence',
  },
  {
    id: 'NEEDS_CONNECTION',
    label: 'Needs connection',
    description: 'LinkedIn / Gmail / WhatsApp not connected',
  },
  {
    id: 'CONNECTION_SENT',
    label: 'Connection sent',
    description: 'LinkedIn connection request',
  },
  {
    id: 'CONNECTION_ACCEPTED',
    label: 'Connection accepted',
    description: 'LinkedIn connection accepted',
  },
  {
    id: 'CONNECTION_IGNORED',
    label: 'Connection ignored',
    description: 'Connection request ignored — fallback to email / InMail',
  },
  {
    id: 'PROFILE_CHECKED',
    label: 'Profile checked',
    description: 'Active profile / recent posts scored',
  },
  {
    id: 'WARM_PATH',
    label: 'Warm path',
    description: 'Colleague intro paths resolved',
  },
  {
    id: 'COMMENTED',
    label: 'Commented',
    description: 'Comment on a recent post when active',
  },
  {
    id: 'EMAIL_ENRICHING',
    label: 'Enriching email',
    description: 'Waterfall / BYOK enrichment child workflow',
  },
  {
    id: 'EMAIL_SENT',
    label: 'Email sent',
    description: 'Day-3 follow-up email',
  },
  {
    id: 'INMAIL_SENT',
    label: 'InMail sent',
    description: 'Paid InMail fallback after connect ignore',
  },
  {
    id: 'WHATSAPP_SENT',
    label: 'WhatsApp sent',
    description: 'WhatsApp follow-up sent',
  },
  {
    id: 'WAITING_REPLY',
    label: 'Waiting for reply',
    description: 'We replied; waiting on them',
  },
  {
    id: 'DEFERRED',
    label: 'Deferred',
    description: 'Below max personas per company — promote to enroll',
  },
  {
    id: 'STOPPED',
    label: 'Stopped',
    description: 'Do-not-contact',
  },
  {
    id: 'REPLIED',
    label: 'Replied',
    description: 'Inbound reply received',
  },
  {
    id: 'NEGOTIATING',
    label: 'Negotiating',
    description: 'Agent negotiating meeting time',
  },
  {
    id: 'MEETING_BOOKED',
    label: 'Meeting booked',
    description: 'Calendar invites sent to both sides',
  },
  {
    id: 'FAILED_NO_REPLY',
    label: 'Failed no reply',
    description: 'No reply after follow-ups',
  },
  {
    id: 'FAILED_ENRICH',
    label: 'Failed enrich',
    description: 'Email enrichment failed',
  },
];

const OUTREACH_STAGE_SET = new Set<string>(
  OUTREACH_STAGES.map((stage) => stage.id).concat([
    'FOLLOW_UP_1',
    'FOLLOW_UP_2',
    'FOLLOW_UP_3',
  ]),
);

// Normalize CRM / legacy UI stage strings to the CRM enum used everywhere.
export const normalizeOutreachStage = (
  stage: string | null | undefined,
): OutreachStage => {
  const normalized = (stage ?? 'QUEUED').trim().toUpperCase();

  switch (normalized) {
    case 'BOOKED':
      return 'MEETING_BOOKED';
    case 'FOLLOWED_UP':
    case 'FOLLOWED_UP_1':
      return 'FOLLOW_UP_1';
    case 'FOLLOWED_UP_2':
      return 'FOLLOW_UP_2';
    case 'FOLLOWED_UP_3':
      return 'FOLLOW_UP_3';
    default:
      if (OUTREACH_STAGE_SET.has(normalized)) {
        return normalized as OutreachStage;
      }

      return 'QUEUED';
  }
};

// Kept name for existing call sites; no longer downcases to UI ids.
export const mapCrmStageToOutreachStage = normalizeOutreachStage;
