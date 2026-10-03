export const OUTREACH_DECISION_NOW_KINDS = [
  'REPLY_DRAFT',
  'MEETING_ACTION',
] as const;

export const OUTREACH_DECISION_APPROVE_KINDS = [
  'MESSAGE_DRAFT',
  'CONNECTION_NOTE',
  'COMMENT_DRAFT',
] as const;

export type OutreachDecisionKind =
  | (typeof OUTREACH_DECISION_NOW_KINDS)[number]
  | (typeof OUTREACH_DECISION_APPROVE_KINDS)[number];

export type OutreachDecisionResolution = 'APPROVED' | 'EDITED' | 'REJECTED';

export type OutreachDecisionListItem = {
  id: string;
  kind: OutreachDecisionKind;
  urgency: 'NOW' | 'APPROVE';
  status: string;
  title: string;
  recommendation: string;
  reason: string;
  draftBody: string;
  stepId: string;
  projectId: string | null;
  candidateId: string | null;
  personId: string | null;
  companyId: string | null;
  workflowRunId: string | null;
  personName: string;
  personTitle: string;
  companyName: string;
  projectName: string;
};

export type OutreachDecisionGroup = {
  key: string;
  projectName: string;
  reason: string;
  decisions: OutreachDecisionListItem[];
};
