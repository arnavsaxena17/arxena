import { useRecoilCallback, useRecoilValue } from 'recoil';

import { CurrentUser, currentUserState } from '@/auth/states/currentUserState';
import {
    CurrentWorkspace,
    currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { useConnectLinkedinOnboardingState } from '@/client-config/states/useConnectLinkedinOnboardingState';
import { isDefined } from 'twenty-shared';
import { OnboardingStatus } from '~/generated/graphql';

const getNextOnboardingStatus = (
  currentUser: CurrentUser | null,
  currentWorkspace: CurrentWorkspace | null,
  useConnectLinkedinOnboarding: boolean,
) => {
  if (currentUser?.onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION) {
    return OnboardingStatus.PROFILE_CREATION;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.PROFILE_CREATION) {
    return useConnectLinkedinOnboarding
      ? OnboardingStatus.CONNECT_LINKEDIN
      : OnboardingStatus.SYNC_EMAIL;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.CONNECT_LINKEDIN) {
    return OnboardingStatus.SYNC_EMAIL;
  }

  if (
    currentUser?.onboardingStatus === OnboardingStatus.SYNC_EMAIL &&
    currentWorkspace?.workspaceMembersCount === 1
  ) {
    return OnboardingStatus.INVITE_TEAM;
  }
  return OnboardingStatus.COMPLETED;
};

export const useSetNextOnboardingStatus = () => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const useConnectLinkedinOnboarding = useRecoilValue(
    useConnectLinkedinOnboardingState,
  );

  return useRecoilCallback(
    ({ set }) =>
      () => {
        const nextOnboardingStatus = getNextOnboardingStatus(
          currentUser,
          currentWorkspace,
          useConnectLinkedinOnboarding,
        );
        set(currentUserState, (current) => {
          if (isDefined(current)) {
            return {
              ...current,
              onboardingStatus: nextOnboardingStatus,
            };
          }
          return current;
        });
      },
    [currentWorkspace, currentUser, useConnectLinkedinOnboarding],
  );
};
