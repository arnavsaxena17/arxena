export const OUTREACH_DASHBOARD_TITLE = 'Outreach';

// Legacy name prefix — kept so older projects without outreachConfig still list.
export const OUTREACH_PROJECT_NAME_PREFIX = 'Outreach Project';

export const isOutreachProjectName = (
  name: string | null | undefined,
): boolean => (name ?? '').startsWith(OUTREACH_PROJECT_NAME_PREFIX);

/** Query param for active Project on /outreach-home */
export const OUTREACH_PROJECT_ID_QUERY_PARAM = 'projectId';

/** Canonical Stage B sequencer workflow name. */
export const OUTREACH_WORKFLOW_B_NAME = 'Outreach — Per Enrolled Candidate';

/** Canonical Stage C sequencer workflow name. */
export const OUTREACH_WORKFLOW_C_NAME = 'Outreach — Enrolled Person Updated';
