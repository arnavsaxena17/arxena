import { type OutreachStage } from '@/outreach-home/types/outreach-home.types';

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
    case 'DEFERRED':
      return 'deferred';
    case 'STOPPED':
      return 'stopped';
    case 'REPLIED':
    case 'CONNECTION_ACCEPTED':
      return normalized === 'CONNECTION_ACCEPTED' ? 'profile_checked' : 'replied';
    case 'NEGOTIATING':
      return 'negotiating';
    case 'MEETING_BOOKED':
    case 'BOOKED':
      return 'meeting_booked';
    case 'QUEUED':
    default:
      return 'queued';
  }
};
