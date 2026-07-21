import { createState } from 'twenty-ui';

export const skipOptionalOnboardingStepsState = createState<boolean>({
  key: 'skipOptionalOnboardingSteps',
  defaultValue: false,
});
