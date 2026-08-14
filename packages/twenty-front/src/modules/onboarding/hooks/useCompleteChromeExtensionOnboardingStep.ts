import { useSetNextOnboardingStatus } from '@/onboarding/hooks/useSetNextOnboardingStatus';
import { useMutation } from '@apollo/client/react';
import { useCallback } from 'react';
import { CompleteChromeExtensionOnboardingStepDocument } from '~/generated-metadata/graphql';

export const useCompleteChromeExtensionOnboardingStep = () => {
  const setNextOnboardingStatus = useSetNextOnboardingStatus();
  const [completeChromeExtensionOnboardingStepMutation] = useMutation(
    CompleteChromeExtensionOnboardingStepDocument,
  );

  return useCallback(async () => {
    await completeChromeExtensionOnboardingStepMutation();
    setNextOnboardingStatus();
  }, [completeChromeExtensionOnboardingStepMutation, setNextOnboardingStatus]);
};
