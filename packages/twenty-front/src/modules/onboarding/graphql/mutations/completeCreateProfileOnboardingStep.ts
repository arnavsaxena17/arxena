import { gql } from '@apollo/client';

export const COMPLETE_CREATE_PROFILE_ONBOARDING_STEP = gql`
  mutation CompleteCreateProfileOnboardingStep {
    completeCreateProfileOnboardingStep {
      success
    }
  }
`;
