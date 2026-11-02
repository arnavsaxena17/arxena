import { currentUserState } from '@/auth/states/currentUserState';
import { isWelcomeAnimationVisibleState } from '@/onboarding/states/isWelcomeAnimationVisibleState';
import { shouldOpenAiChatAfterOnboardingState } from '@/onboarding/states/shouldOpenAiChatAfterOnboardingState';
import { getHasJustCompletedOnboarding } from '@/onboarding/utils/getHasJustCompletedOnboarding';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { FeatureFlagKey } from '~/generated-metadata/graphql';

// The onboarding flow is owned by the server: onboardingStatus is derived from
// the pending step flags, which ONBOARDING_ENABLED_STEPS decides. This hook
// therefore re-reads the current user instead of computing the next step
// locally, so disabling a step server-side is enough to skip it in the client.
export const useSetNextOnboardingStatus = () => {
  const store = useStore();
  const currentUser = useAtomStateValue(currentUserState);
  const { loadCurrentUser } = useLoadCurrentUser();
  const isOnboardingAiChatEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_ONBOARDING_AI_CHAT_ENABLED,
  );

  return useCallback(async () => {
    const previousOnboardingStatus = currentUser?.onboardingStatus;

    const { user } = await loadCurrentUser();

    const nextOnboardingStatus = user?.onboardingStatus;

    if (
      getHasJustCompletedOnboarding({
        previousOnboardingStatus,
        nextOnboardingStatus,
      })
    ) {
      store.set(isWelcomeAnimationVisibleState.atom, true);
      store.set(
        shouldOpenAiChatAfterOnboardingState.atom,
        isOnboardingAiChatEnabled,
      );
    }
  }, [
    currentUser?.onboardingStatus,
    isOnboardingAiChatEnabled,
    loadCurrentUser,
    store,
  ]);
};
