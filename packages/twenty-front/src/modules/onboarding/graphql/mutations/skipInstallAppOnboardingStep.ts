import { gql } from '@apollo/client';

export const SKIP_INSTALL_APP_ONBOARDING_STEP = gql`
  mutation SkipInstallAppOnboardingStep {
    skipInstallAppOnboardingStep {
      success
    }
  }
`;
