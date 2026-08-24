export const GTM_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME =
  'GtmWorkspaceProfileBootstrapJob';

export type GtmWorkspaceProfileBootstrapJobData = {
  workspaceId: string;
  userEmail?: string | null;
  workspaceDisplayName?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  force?: boolean;
};
