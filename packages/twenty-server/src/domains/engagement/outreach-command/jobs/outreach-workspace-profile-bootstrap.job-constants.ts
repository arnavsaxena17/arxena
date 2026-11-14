export const OUTREACH_WORKSPACE_PROFILE_BOOTSTRAP_JOB_NAME =
  'OutreachWorkspaceProfileBootstrapJob';

export type OutreachWorkspaceProfileBootstrapJobData = {
  workspaceId: string;
  userEmail?: string | null;
  workspaceDisplayName?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  force?: boolean;
};
