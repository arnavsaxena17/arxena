import { type OutreachStage } from '@/outreach-home/types/outreach-home.types';

export const OUTREACH_STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  QUEUED: 'Queued',
  needs_connection: 'Needs connection',
  NEEDS_CONNECTION: 'Needs connection',
  connection_sent: 'Connection sent',
  CONNECTION_SENT: 'Connection sent',
  connection_accepted: 'Connection accepted',
  CONNECTION_ACCEPTED: 'Connection accepted',
  connection_ignored: 'Connection ignored',
  CONNECTION_IGNORED: 'Connection ignored',
  profile_checked: 'Profile checked',
  PROFILE_CHECKED: 'Profile checked',
  warm_path: 'Warm path',
  WARM_PATH: 'Warm path',
  commented: 'Commented',
  COMMENTED: 'Commented',
  email_enriching: 'Enriching email',
  EMAIL_ENRICHING: 'Enriching email',
  email_sent: 'Email sent',
  EMAIL_SENT: 'Email sent',
  inmail_sent: 'InMail sent',
  INMAIL_SENT: 'InMail sent',
  whatsapp_sent: 'WhatsApp sent',
  WHATSAPP_SENT: 'WhatsApp sent',
  followed_up: 'Followed up 1',
  FOLLOW_UP_1: 'Followed up 1',
  followed_up_2: 'Followed up 2',
  FOLLOW_UP_2: 'Followed up 2',
  followed_up_3: 'Followed up 3',
  FOLLOW_UP_3: 'Followed up 3',
  deferred: 'Waiting for slot',
  DEFERRED: 'Waiting for slot',
  stopped: 'Stopped',
  STOPPED: 'Stopped',
  replied: 'Replied',
  REPLIED: 'Replied',
  negotiating: 'Negotiating',
  NEGOTIATING: 'Negotiating',
  meeting_booked: 'Meeting booked',
  MEETING_BOOKED: 'Meeting booked',
  BOOKED: 'Meeting booked',
  FAILED_ENRICH: 'Failed enrich',
  failed_enrich: 'Failed enrich',
  FAILED_NO_REPLY: 'Failed no reply',
  failed_no_reply: 'Failed no reply',
  WAITING_REPLY: 'Waiting for reply',
  waiting_reply: 'Waiting for reply',
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
    id: 'queued',
    label: 'Queued',
    description: 'Waiting to enter the outreach sequence',
  },
  {
    id: 'needs_connection',
    label: 'Needs connection',
    description: 'LinkedIn / Gmail / WhatsApp not connected',
  },
  {
    id: 'connection_sent',
    label: 'Connection sent',
    description: 'LinkedIn connection request',
  },
  {
    id: 'connection_accepted',
    label: 'Connection accepted',
    description: 'LinkedIn connection accepted',
  },
  {
    id: 'connection_ignored',
    label: 'Connection ignored',
    description: 'Connection request ignored — fallback to email / InMail',
  },
  {
    id: 'profile_checked',
    label: 'Profile checked',
    description: 'Active profile / recent posts scored',
  },
  {
    id: 'warm_path',
    label: 'Warm path',
    description: 'Colleague intro paths resolved',
  },
  {
    id: 'commented',
    label: 'Commented',
    description: 'Comment on a recent post when active',
  },
  {
    id: 'email_enriching',
    label: 'Enriching email',
    description: 'Waterfall / BYOK enrichment child workflow',
  },
  {
    id: 'email_sent',
    label: 'Email sent',
    description: 'Day-3 follow-up email',
  },
  {
    id: 'inmail_sent',
    label: 'InMail sent',
    description: 'Paid InMail fallback after connect ignore',
  },
  {
    id: 'whatsapp_sent',
    label: 'WhatsApp sent',
    description: 'WhatsApp follow-up sent',
  },
  {
    id: 'waiting_reply',
    label: 'Waiting for reply',
    description: 'We replied; waiting on them',
  },
  {
    id: 'deferred',
    label: 'Deferred',
    description: 'Below max personas per company — promote to enroll',
  },
  {
    id: 'stopped',
    label: 'Stopped',
    description: 'Do-not-contact',
  },
  {
    id: 'replied',
    label: 'Replied',
    description: 'Inbound reply received',
  },
  {
    id: 'negotiating',
    label: 'Negotiating',
    description: 'Agent negotiating meeting time',
  },
  {
    id: 'meeting_booked',
    label: 'Meeting booked',
    description: 'Calendar invites sent to both sides',
  },
  {
    id: 'failed_no_reply',
    label: 'Failed no reply',
    description: 'No reply after follow-ups',
  },
  {
    id: 'failed_enrich',
    label: 'Failed enrich',
    description: 'Email enrichment failed',
  },
];

export const mapCrmStageToOutreachStage = (
  stage: string | null | undefined,
): OutreachStage => {
  const normalized = (stage ?? 'QUEUED').toUpperCase();

  switch (normalized) {
    case 'NEEDS_CONNECTION':
      return 'needs_connection';
    case 'CONNECTION_SENT':
      return 'connection_sent';
    case 'CONNECTION_ACCEPTED':
      return 'connection_accepted';
    case 'CONNECTION_IGNORED':
      return 'connection_ignored';
    case 'PROFILE_CHECKED':
      return 'profile_checked';
    case 'WARM_PATH':
      return 'warm_path';
    case 'COMMENTED':
      return 'commented';
    case 'EMAIL_ENRICHING':
      return 'email_enriching';
    case 'EMAIL_SENT':
      return 'email_sent';
    case 'INMAIL_SENT':
      return 'inmail_sent';
    case 'WHATSAPP_SENT':
      return 'whatsapp_sent';
    case 'FOLLOW_UP_1':
    case 'FOLLOWED_UP':
    case 'FOLLOWED_UP_1':
      return 'followed_up';
    case 'FOLLOW_UP_2':
    case 'FOLLOWED_UP_2':
      return 'followed_up_2';
    case 'FOLLOW_UP_3':
    case 'FOLLOWED_UP_3':
      return 'followed_up_3';
    case 'WAITING_REPLY':
      return 'waiting_reply';
    case 'DEFERRED':
      return 'deferred';
    case 'STOPPED':
      return 'stopped';
    case 'REPLIED':
      return 'replied';
    case 'NEGOTIATING':
      return 'negotiating';
    case 'MEETING_BOOKED':
    case 'BOOKED':
      return 'meeting_booked';
    case 'FAILED_NO_REPLY':
      return 'failed_no_reply';
    case 'FAILED_ENRICH':
      return 'failed_enrich';
    case 'QUEUED':
    default:
      return 'queued';
  }
};
