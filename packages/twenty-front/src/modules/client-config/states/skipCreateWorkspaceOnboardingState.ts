import { createState } from 'twenty-ui';

export const skipCreateWorkspaceOnboardingState = createState<boolean>({
  key: 'skipCreateWorkspaceOnboarding',
  defaultValue: false,
});
