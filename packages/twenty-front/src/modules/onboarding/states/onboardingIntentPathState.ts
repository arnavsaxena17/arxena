import { currentUserState } from '@/auth/states/currentUserState';
import { selector } from 'recoil';
import { OnboardingIntentPath } from '~/generated/graphql';

const isOnboardingIntentPath = (
  value: unknown,
): value is OnboardingIntentPath => {
  return (
    value === OnboardingIntentPath.COMPETITIVE_RESEARCH ||
    value === OnboardingIntentPath.DEAL_DILIGENCE ||
    value === OnboardingIntentPath.EXTENSION_INSTALL
  );
};

export const onboardingIntentPathState = selector<OnboardingIntentPath | null>({
  key: 'onboardingIntentPathState',
  get: ({ get }) => {
    const currentUser = get(currentUserState);
    const userVars = currentUser?.userVars as Record<string, unknown> | undefined;

    const intentPath = userVars?.ONBOARDING_INTENT_PATH;

    return isOnboardingIntentPath(intentPath) ? intentPath : null;
  },
});

