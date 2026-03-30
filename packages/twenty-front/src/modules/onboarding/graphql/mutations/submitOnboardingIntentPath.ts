import { gql } from '@apollo/client';

export const SUBMIT_ONBOARDING_INTENT_PATH = gql`
  mutation SubmitOnboardingIntentPath($path: OnboardingIntentPath!) {
    submitOnboardingIntentPath(path: $path) {
      success
    }
  }
`;
