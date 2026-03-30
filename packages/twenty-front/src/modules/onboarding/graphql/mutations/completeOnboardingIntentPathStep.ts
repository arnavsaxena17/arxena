import { gql } from '@apollo/client';

export const COMPLETE_ONBOARDING_INTENT_PATH_STEP = gql`
  mutation CompleteOnboardingIntentPathStep {
    completeOnboardingIntentPathStep {
      success
    }
  }
`;
