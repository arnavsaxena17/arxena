import { gql } from '@apollo/client';

export const COMPLETE_CHROME_EXTENSION_ONBOARDING_STEP = gql`
  mutation CompleteChromeExtensionOnboardingStep {
    completeChromeExtensionOnboardingStep {
      success
    }
  }
`;
