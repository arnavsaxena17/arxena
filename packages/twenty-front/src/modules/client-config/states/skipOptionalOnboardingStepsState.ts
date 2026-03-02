import { createState } from '@ui/utilities/state/utils/createState';

export const skipOptionalOnboardingStepsState = createState<boolean>({
  key: 'skipOptionalOnboardingSteps',
  defaultValue: false,
});
