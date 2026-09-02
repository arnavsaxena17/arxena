export const OUTREACH_DASHBOARD_WORKFLOW_CONTROL_TAB_TITLE = 'Workflow control';

export const OUTREACH_STAGE_C_BRANCH_STAGES = [
  'CONNECTION_ACCEPTED',
  'REPLIED',
  'NEGOTIATING',
  'DEFERRED',
  'MEETING_BOOKED',
] as const;

export const OUTREACH_ACTIVE_WORKFLOW_RUN_STATUSES = [
  'RUNNING',
  'ENQUEUED',
  'STOPPING',
] as const;

export const OUTREACH_ATTENTION_REASON_VALUES = [
  'NO_REPLY',
  'CONNECT_IGNORE',
  'ENRICH_MISS',
  'STUCK_STAGE',
  'NEEDS_CONNECTION',
] as const;

export const OUTREACH_DASHBOARD_WORKFLOW_CONTROL_VIEW_NAMES = {
  hitlApprovalQueue: 'Outreach dashboard: HITL approval queue',
  activeCandidateWorkflowRuns: 'Outreach dashboard: Active candidate workflow runs',
  failedWorkflowRuns: 'Outreach dashboard: Failed workflow runs',
  stageCCandidates: 'Outreach dashboard: Stage C candidates',
} as const;
