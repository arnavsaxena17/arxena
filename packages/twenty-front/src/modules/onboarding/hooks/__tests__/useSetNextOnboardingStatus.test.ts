import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { createElement } from 'react';

import { currentUserState } from '@/auth/states/currentUserState';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { isWelcomeAnimationVisibleState } from '@/onboarding/states/isWelcomeAnimationVisibleState';
import { shouldOpenAiChatAfterOnboardingState } from '@/onboarding/states/shouldOpenAiChatAfterOnboardingState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';

import { OnboardingStatus } from '~/generated-metadata/graphql';
import { mockedUserData } from '~/testing/mock-data/users';

jest.mock('@/users/hooks/useLoadCurrentUser');
jest.mock('@/workspace/hooks/useIsFeatureEnabled');

const Wrapper = ({ children }: { children: React.ReactNode }) =>
  createElement(JotaiProvider, { store: jotaiStore }, children);

type RenderHookOptions = {
  previousOnboardingStatus: OnboardingStatus;
  serverOnboardingStatus: OnboardingStatus;
  isOnboardingAiChatEnabled?: boolean;
};

const renderHookWithServerStatus = async ({
  previousOnboardingStatus,
  serverOnboardingStatus,
  isOnboardingAiChatEnabled = false,
}: RenderHookOptions) => {
  const loadCurrentUser = jest.fn().mockResolvedValue({
    user: { ...mockedUserData, onboardingStatus: serverOnboardingStatus },
  });

  jest.mocked(useLoadCurrentUser).mockReturnValue({ loadCurrentUser });
  jest
    .mocked(useIsFeatureEnabled)
    .mockReturnValue(isOnboardingAiChatEnabled);

  const { result } = renderHook(
    () => {
      const [currentUser, setCurrentUser] = useAtomState(currentUserState);
      const setNextOnboardingStatus = useSetNextOnboardingStatus();
      const isWelcomeAnimationVisible = useAtomStateValue(
        isWelcomeAnimationVisibleState,
      );
      const shouldOpenAiChatAfterOnboarding = useAtomStateValue(
        shouldOpenAiChatAfterOnboardingState,
      );

      return {
        currentUser,
        setCurrentUser,
        setNextOnboardingStatus,
        isWelcomeAnimationVisible,
        shouldOpenAiChatAfterOnboarding,
      };
    },
    { wrapper: Wrapper },
  );

  act(() => {
    result.current.setCurrentUser({
      ...mockedUserData,
      onboardingStatus: previousOnboardingStatus,
    });
  });

  await act(async () => {
    await result.current.setNextOnboardingStatus();
  });

  return { loadCurrentUser, result };
};

describe('useSetNextOnboardingStatus', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetJotaiStore();
    jest.clearAllMocks();
  });

  it('should re-read the onboarding status from the server', async () => {
    const { loadCurrentUser, result } = await renderHookWithServerStatus({
      previousOnboardingStatus: OnboardingStatus.PROFILE_CREATION,
      serverOnboardingStatus: OnboardingStatus.EXTENSION_INSTALL,
    });

    expect(loadCurrentUser).toHaveBeenCalled();
    expect(result.current.isWelcomeAnimationVisible).toBe(false);
  });

  it('should show the welcome animation when the server reports completion', async () => {
    const { result } = await renderHookWithServerStatus({
      previousOnboardingStatus: OnboardingStatus.EXTENSION_INSTALL,
      serverOnboardingStatus: OnboardingStatus.COMPLETED,
    });

    expect(result.current.isWelcomeAnimationVisible).toBe(true);
  });

  it('should open the ai chat after onboarding when the feature flag is enabled', async () => {
    const { result } = await renderHookWithServerStatus({
      previousOnboardingStatus: OnboardingStatus.EXTENSION_INSTALL,
      serverOnboardingStatus: OnboardingStatus.COMPLETED,
      isOnboardingAiChatEnabled: true,
    });

    expect(result.current.shouldOpenAiChatAfterOnboarding).toBe(true);
  });

  it('should not replay the welcome animation when onboarding was already completed', async () => {
    const { result } = await renderHookWithServerStatus({
      previousOnboardingStatus: OnboardingStatus.COMPLETED,
      serverOnboardingStatus: OnboardingStatus.COMPLETED,
    });

    expect(result.current.isWelcomeAnimationVisible).toBe(false);
  });
});
