import { FeatureFlag } from '@/settings/admin-panel/types/FeatureFlag';

export type AdminPanelWorkspaceMemberRecruiterProfile = {
  workspaceMemberId?: string | null;
  profileId?: string | null;
  phoneNumber?: string | null;
  linkedinUrl?: string | null;
  linkedinUnipileAccountId?: string | null;
  whatsappUnipileAccountId?: string | null;
  keepLinkedinConnected?: boolean | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  companyDescription?: string | null;
  typeWorkspaceMember?: string | null;
  chromeExtensionId?: string | null;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  logo?: string | null;
  totalUsers: number;
  users: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  }[];
  featureFlags: FeatureFlag[];
  allowImpersonation: boolean;
  recruiterProfileForLookedUpUser?: AdminPanelWorkspaceMemberRecruiterProfile | null;
};
