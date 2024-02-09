import { CurrentWorkspace } from '@/auth/states/currentWorkspaceState';
import { WorkspaceMember } from '@/workspace-member/types/WorkspaceMember';

export enum OnboardingStatus {
  Incomplete = 'incomplete',
  Canceled = 'canceled',
  OngoingUserCreation = 'ongoing_user_creation',
  OngoingWorkspaceActivation = 'ongoing_workspace_activation',
  OngoingProfileCreation = 'ongoing_profile_creation',
  Completed = 'completed',
}

export const getOnboardingStatus = ({
  isLoggedIn,
  currentWorkspaceMember,
  currentWorkspace,
  isBillingEnabled,
}: {
  isLoggedIn: boolean;
  currentWorkspaceMember: Omit<
    WorkspaceMember,
    'createdAt' | 'updatedAt' | 'userId' | 'userEmail'
  > | null;
  currentWorkspace: CurrentWorkspace | null;
  isBillingEnabled?: boolean;
}) => {
  if (!isLoggedIn) {
    return OnboardingStatus.OngoingUserCreation;
  }

  if (
    isBillingEnabled &&
    currentWorkspace?.subscriptionStatus === 'incomplete'
  ) {
    return OnboardingStatus.Incomplete;
  }

  if (isBillingEnabled && currentWorkspace?.subscriptionStatus === 'canceled') {
    return OnboardingStatus.Canceled;
  }

  if (!currentWorkspaceMember) {
    return OnboardingStatus.OngoingWorkspaceActivation;
  }

  if (
    !currentWorkspaceMember.name.firstName ||
    !currentWorkspaceMember.name.lastName
  ) {
    return OnboardingStatus.OngoingProfileCreation;
  }

  return OnboardingStatus.Completed;
};
