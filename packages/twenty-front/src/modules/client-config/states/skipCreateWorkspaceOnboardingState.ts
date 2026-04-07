import { createState } from '@ui/utilities/state/utils/createState';

export const skipCreateWorkspaceOnboardingState = createState<boolean>({
  key: 'skipCreateWorkspaceOnboarding',
  defaultValue: false,
});
