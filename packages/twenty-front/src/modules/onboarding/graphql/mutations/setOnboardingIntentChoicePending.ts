import { gql } from '@apollo/client';

export const SET_ONBOARDING_INTENT_CHOICE_PENDING = gql`
  mutation SetOnboardingIntentChoicePending {
    setOnboardingIntentChoicePending {
      success
    }
  }
`;
