import { gql } from '@apollo/client';

export const SKIP_CONNECT_LINKEDIN_ONBOARDING_STEP = gql`
  mutation SkipConnectLinkedinOnboardingStep {
    skipConnectLinkedinOnboardingStep {
      success
    }
  }
`;
