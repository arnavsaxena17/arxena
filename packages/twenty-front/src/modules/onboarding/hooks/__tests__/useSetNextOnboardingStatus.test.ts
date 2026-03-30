import { act, renderHook } from '@testing-library/react';
import { RecoilRoot, useRecoilState, useSetRecoilState } from 'recoil';
import { v4 } from 'uuid';

import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { skipOptionalOnboardingStepsState } from '@/client-config/states/skipOptionalOnboardingStepsState';
import { useConnectLinkedinOnboardingState } from '@/client-config/states/useConnectLinkedinOnboardingState';
import { useIntentChoiceOnboardingState } from '@/client-config/states/useIntentChoiceOnboardingState';
import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import {
  FeatureFlagKey,
  OnboardingStatus,
  SubscriptionStatus,
} from '~/generated/graphql';
import {
    mockCurrentWorkspace,
    mockedUserData,
} from '~/testing/mock-data/users';

const renderHooks = (
  onboardingStatus: OnboardingStatus,
  withCurrentBillingSubscription: boolean,
  withOneWorkspaceMember = true,
  skipOptionalOnboardingSteps = false,
  useConnectLinkedinOnboarding = false,
  useIntentChoiceOnboarding = false,
  collectPhoneNumberInOnboarding = true,
) => {
  const { result } = renderHook(
    () => {
      const [currentUser, setCurrentUser] = useRecoilState(currentUserState);
      const setCurrentWorkspace = useSetRecoilState(currentWorkspaceState);
      const setSkipOptionalOnboardingSteps = useSetRecoilState(
        skipOptionalOnboardingStepsState,
      );
      const setUseConnectLinkedinOnboarding = useSetRecoilState(
        useConnectLinkedinOnboardingState,
      );
      const setUseIntentChoiceOnboarding = useSetRecoilState(
        useIntentChoiceOnboardingState,
      );
      const setNextOnboardingStatus = useSetNextOnboardingStatus();
      return {
        currentUser,
        setCurrentUser,
        setCurrentWorkspace,
        setSkipOptionalOnboardingSteps,
        setUseConnectLinkedinOnboarding,
        setUseIntentChoiceOnboarding,
        setNextOnboardingStatus,
      };
    },
    {
      wrapper: RecoilRoot,
    },
  );
  act(() => {
    result.current.setCurrentUser({ ...mockedUserData, onboardingStatus });
    result.current.setCurrentWorkspace({
      ...mockCurrentWorkspace,
      currentBillingSubscription: withCurrentBillingSubscription
        ? { id: v4(), status: SubscriptionStatus.Active }
        : undefined,
      workspaceMembersCount: withOneWorkspaceMember ? 1 : 2,
      featureFlags: collectPhoneNumberInOnboarding
        ? [
            ...mockCurrentWorkspace.featureFlags,
            {
              id: v4(),
              key: FeatureFlagKey.IsCollectPhoneNumberInOnboarding,
              value: true,
              workspaceId: mockCurrentWorkspace.id,
            },
          ]
        : [],
    });
    result.current.setSkipOptionalOnboardingSteps(skipOptionalOnboardingSteps);
    result.current.setUseConnectLinkedinOnboarding(useConnectLinkedinOnboarding);
    result.current.setUseIntentChoiceOnboarding(useIntentChoiceOnboarding);
  });
  act(() => {
    result.current.setNextOnboardingStatus();
  });
  return result.current.currentUser?.onboardingStatus;
};

describe('useSetNextOnboardingStatus', () => {
  it('should set next onboarding status for ProfileCreation', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COLLECT_PHONE_NUMBER);
  });

  it('should set next onboarding status for SyncEmail', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      false,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INVITE_TEAM);
  });

  it('should skip invite when more than 1 workspaceMember exist', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.SYNC_EMAIL,
      true,
      false,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });

  it('should set next onboarding status for Completed', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.INVITE_TEAM,
      true,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COMPLETED);
  });

  it('should skip to Completed when skipOptionalOnboardingSteps is true after ProfileCreation', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.PROFILE_CREATION,
      false,
      true,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.COLLECT_PHONE_NUMBER);
  });

  it('should go to IntentChoice after phone collection when intent onboarding is enabled', () => {
    const nextOnboardingStatus = renderHooks(
      OnboardingStatus.COLLECT_PHONE_NUMBER,
      false,
      true,
      false,
      false,
      true,
    );
    expect(nextOnboardingStatus).toEqual(OnboardingStatus.INTENT_CHOICE);
  });
});
