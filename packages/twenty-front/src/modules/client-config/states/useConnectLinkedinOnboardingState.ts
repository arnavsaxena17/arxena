import { createState } from 'twenty-ui';

export const useConnectLinkedinOnboardingState = createState<boolean>({
  key: 'useConnectLinkedinOnboarding',
  defaultValue: true,
});
