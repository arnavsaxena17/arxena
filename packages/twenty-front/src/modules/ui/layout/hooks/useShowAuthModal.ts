import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { AppPath } from '@/types/AppPath';
import { isDefaultLayoutAuthModalVisibleState } from '@/ui/layout/states/isDefaultLayoutAuthModalVisibleState';
import { OnboardingStatus } from '~/generated/graphql';
import { useIsMatchingLocation } from '~/hooks/useIsMatchingLocation';

export const useShowAuthModal = () => {
  const { isMatchingLocation } = useIsMatchingLocation();
  const isLoggedIn = useIsLogged();
  const onboardingStatus = useOnboardingStatus();

  const isDefaultLayoutAuthModalVisible = useRecoilValue(
    isDefaultLayoutAuthModalVisibleState,
  );

  return useMemo(() => {
    if (isMatchingLocation(AppPath.Verify)) {
      return false;
    }

    if (
      isMatchingLocation(AppPath.Invite) ||
      isMatchingLocation(AppPath.ResetPassword) ||
      isMatchingLocation(AppPath.VerifyEmail) ||
      isMatchingLocation(AppPath.SignInUp)
    ) {
      return isDefaultLayoutAuthModalVisible;
    }

    if (
      !isLoggedIn ||
      onboardingStatus === OnboardingStatus.PROFILE_CREATION ||
      onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION ||
      onboardingStatus === OnboardingStatus.CONNECT_LINKEDIN ||
      onboardingStatus === OnboardingStatus.INSTALL_APP ||
      onboardingStatus === OnboardingStatus.SYNC_EMAIL ||
      onboardingStatus === OnboardingStatus.INVITE_TEAM
    ) {
      return true;
    }

    return false;
  }, [
    isLoggedIn,
    isDefaultLayoutAuthModalVisible,
    isMatchingLocation,
    onboardingStatus,
  ]);
};
