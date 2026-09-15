export const OUTREACH_DASHBOARD_TITLE = 'Outreach';

// Legacy name prefix — kept so older projects without outreachConfig still list.
export const OUTREACH_PROJECT_NAME_PREFIX = 'Outreach Project';

export const isOutreachProjectName = (
  name: string | null | undefined,
): boolean => (name ?? '').startsWith(OUTREACH_PROJECT_NAME_PREFIX);

/** Query param for active Project on /outreach-home */
export const OUTREACH_PROJECT_ID_QUERY_PARAM = 'projectId';

/** Canonical Candidate Sequencer workflow name (merged Stage B + C). */
export const OUTREACH_WORKFLOW_SEQUENCER_NAME =
  'Outreach — Candidate Sequencer';
