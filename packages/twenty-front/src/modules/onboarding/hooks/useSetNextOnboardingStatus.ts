import { useRecoilCallback, useRecoilValue } from 'recoil';

import { CurrentUser, currentUserState } from '@/auth/states/currentUserState';
import {
    CurrentWorkspace,
    currentWorkspaceState,
} from '@/auth/states/currentWorkspaceState';
import { skipOptionalOnboardingStepsState } from '@/client-config/states/skipOptionalOnboardingStepsState';
import { useConnectLinkedinOnboardingState } from '@/client-config/states/useConnectLinkedinOnboardingState';
import { useIntentChoiceOnboardingState } from '@/client-config/states/useIntentChoiceOnboardingState';
import { isDefined } from 'twenty-shared';
import { FeatureFlagKey, OnboardingStatus } from '~/generated/graphql';

const getNextOnboardingStatus = (
  currentUser: CurrentUser | null,
  currentWorkspace: CurrentWorkspace | null,
  useIntentChoiceOnboarding: boolean,
  useConnectLinkedinOnboarding: boolean,
  skipOptionalOnboardingSteps: boolean,
  collectPhoneNumberInOnboarding: boolean,
) => {
  const isInvitedTeamMember =
    (currentWorkspace?.workspaceMembersCount ?? 0) > 1;

  if (currentUser?.onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION) {
    return OnboardingStatus.PROFILE_CREATION;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.PROFILE_CREATION) {
    // Phone collection takes priority over skipOptionalOnboardingSteps
    if (collectPhoneNumberInOnboarding) {
      return OnboardingStatus.COLLECT_PHONE_NUMBER;
    }
    if (useIntentChoiceOnboarding && !isInvitedTeamMember) {
      return OnboardingStatus.INTENT_CHOICE;
    }
    if (skipOptionalOnboardingSteps) {
      return OnboardingStatus.COMPLETED;
    }
    return useConnectLinkedinOnboarding
      ? OnboardingStatus.CONNECT_LINKEDIN
      : OnboardingStatus.SYNC_EMAIL;
  }

  if (currentUser?.onboardingStatus === OnboardingStatus.COLLECT_PHONE_NUMBER) {
    if (useIntentChoiceOnboarding && !isInvitedTeamMember) {
      return OnboardingStatus.INTENT_CHOICE;
    }
    if (skipOptionalOnboardingSteps) {
      return OnboardingStatus.COMPLETED;
    }
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
  const useIntentChoiceOnboarding = useRecoilValue(
    useIntentChoiceOnboardingState,
  );
  const useConnectLinkedinOnboarding = useRecoilValue(
    useConnectLinkedinOnboardingState,
  );
  const skipOptionalOnboardingSteps = useRecoilValue(
    skipOptionalOnboardingStepsState,
  );

  // Default true: show phone step unless flag is explicitly set to false
  const collectPhoneNumberInOnboarding =
    currentWorkspace?.featureFlags?.find(
      (flag) => flag.key === FeatureFlagKey.IsCollectPhoneNumberInOnboarding,
    )?.value ?? true;

  return useRecoilCallback(
    ({ set }) =>
      () => {
        const nextOnboardingStatus = getNextOnboardingStatus(
          currentUser,
          currentWorkspace,
          useIntentChoiceOnboarding,
          useConnectLinkedinOnboarding,
          skipOptionalOnboardingSteps,
          collectPhoneNumberInOnboarding,
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
    [
      currentWorkspace,
      currentUser,
      useIntentChoiceOnboarding,
      useConnectLinkedinOnboarding,
      skipOptionalOnboardingSteps,
      collectPhoneNumberInOnboarding,
    ],
  );
};
