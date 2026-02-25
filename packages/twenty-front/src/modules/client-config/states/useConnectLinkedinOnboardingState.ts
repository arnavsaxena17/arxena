import { createState } from '@ui/utilities/state/utils/createState';

export const useConnectLinkedinOnboardingState = createState<boolean>({
  key: 'useConnectLinkedinOnboarding',
  defaultValue: true,
});
