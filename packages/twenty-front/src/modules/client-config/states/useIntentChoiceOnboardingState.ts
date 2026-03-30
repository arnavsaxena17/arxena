import { createState } from 'twenty-ui';

export const useIntentChoiceOnboardingState = createState<boolean>({
  key: 'useIntentChoiceOnboarding',
  defaultValue: false,
});
