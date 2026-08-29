export const GTM_COMMAND_DASHBOARD_TITLE = 'GTM Command';

export const GTM_PROJECT_NAME_PREFIX = 'GTM Project';

export const GTM_PROJECT_NAME_PREFIX_LEGACY = 'GTM Run';

export const isGtmProjectName = (name: string | null | undefined): boolean => {
  const value = name ?? '';

  return (
    value.startsWith(GTM_PROJECT_NAME_PREFIX) ||
    value.startsWith(GTM_PROJECT_NAME_PREFIX_LEGACY)
  );
};

// Query param for active GTM Project on /gtm-home
export const GTM_PROJECT_ID_QUERY_PARAM = 'projectId';

// Stage B default — always preferred / auto-created for the Workflow tab
export const GTM_OUTREACH_WORKFLOW_B_NAME = 'GTM Outreach — Per Candidate';
