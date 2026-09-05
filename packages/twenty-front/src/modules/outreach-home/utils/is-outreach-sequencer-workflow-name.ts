import {
  OUTREACH_WORKFLOW_B_NAME,
  OUTREACH_WORKFLOW_C_NAME,
} from '@/outreach-home/constants/outreach-command.constants';

const OUTREACH_WORKFLOW_B_NAME_ALIASES = [
  OUTREACH_WORKFLOW_B_NAME,
  'Outreach — Per Enrolled Person',
  'Outreach — Per Candidate',
  'GTM Outreach — Per Candidate',
] as const;

const OUTREACH_WORKFLOW_C_NAME_ALIASES = [
  OUTREACH_WORKFLOW_C_NAME,
  'GTM Outreach — Candidate Updated',
  'GTM Outreach — Candidate Updated - Connection Accepted',
  'GTM Outreach — Candidate Updated - Connection Accepted Onwards',
  'GTM Outreach — Connection Accepted',
  'GTM Outreach — Reply',
  'GTM Outreach — Negotiating',
  'GTM Outreach — Deferred',
  'GTM Outreach — Meeting Booked',
  'Outreach — Reply',
  'Outreach — Negotiating',
  'Outreach — Deferred',
  'Outreach — Meeting Booked',
] as const;

export const OUTREACH_SEQUENCER_WORKFLOW_NAMES = [
  ...OUTREACH_WORKFLOW_B_NAME_ALIASES,
  ...OUTREACH_WORKFLOW_C_NAME_ALIASES,
] as const;

export const isOutreachSequencerWorkflowName = (
  workflowName: string | null | undefined,
): boolean =>
  typeof workflowName === 'string' &&
  (OUTREACH_SEQUENCER_WORKFLOW_NAMES as readonly string[]).includes(
    workflowName,
  );
