import { AppPath } from 'twenty-shared/types';

import { OnboardingStepKeys } from 'src/engine/core-modules/onboarding/constants/onboarding-step-keys.constant';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';

// Steps are resolved in the order they appear in ONBOARDING_STEPS: the first
// enabled step that is still pending wins. Adding or removing a step from the
// flow is therefore driven by this array plus ONBOARDING_ENABLED_STEPS, and
// nothing else in the server or the client needs to know the flow order.
export type OnboardingStepContext = {
  // Only the user who created the workspace is offered the team-building steps.
  isWorkspaceCreator: boolean;
};

export type OnboardingStepSource =
  | { type: 'workspace-activation' }
  | { type: 'billing' }
  | {
      type: 'pending-flag';
      pendingKey: OnboardingStepKeys;
      scope: 'user' | 'workspace';
    };

export type OnboardingStepDefinition = {
  status: OnboardingStatus;
  route: AppPath;
  skippable: boolean;
  // Activation and billing are lifecycle gates, not optional product steps:
  // they are always enabled and cannot be turned off by configuration.
  isToggleable: boolean;
  source: OnboardingStepSource;
  shouldSeed: (context: OnboardingStepContext) => boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStepDefinition[] = [
  {
    status: OnboardingStatus.WORKSPACE_ACTIVATION,
    route: AppPath.WorkspaceActivation,
    skippable: false,
    isToggleable: false,
    source: { type: 'workspace-activation' },
    shouldSeed: () => false,
  },
  {
    status: OnboardingStatus.PROFILE_CREATION,
    route: AppPath.CreateProfile,
    // The step is mandatory: the workspace member needs a name. The phone
    // number collected inside it is optional.
    skippable: false,
    isToggleable: true,
    source: {
      type: 'pending-flag',
      pendingKey: OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING,
      scope: 'user',
    },
    shouldSeed: () => true,
  },
  {
    status: OnboardingStatus.EXTENSION_INSTALL,
    route: AppPath.ExtensionInstallOnboarding,
    skippable: true,
    isToggleable: true,
    source: {
      type: 'pending-flag',
      pendingKey: OnboardingStepKeys.ONBOARDING_EXTENSION_INSTALL_PENDING,
      scope: 'user',
    },
    shouldSeed: () => true,
  },
  {
    status: OnboardingStatus.SYNC_EMAIL,
    route: AppPath.SyncEmails,
    skippable: true,
    isToggleable: true,
    source: {
      type: 'pending-flag',
      pendingKey: OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING,
      scope: 'user',
    },
    shouldSeed: (context) => context.isWorkspaceCreator,
  },
  {
    status: OnboardingStatus.APPS_INSTALLATION,
    route: AppPath.InstallApps,
    skippable: true,
    isToggleable: true,
    source: {
      type: 'pending-flag',
      pendingKey: OnboardingStepKeys.ONBOARDING_INSTALL_APPS_PENDING,
      scope: 'user',
    },
    shouldSeed: (context) => context.isWorkspaceCreator,
  },
  {
    status: OnboardingStatus.INVITE_TEAM,
    route: AppPath.InviteTeam,
    skippable: true,
    isToggleable: true,
    source: {
      type: 'pending-flag',
      pendingKey: OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING,
      scope: 'workspace',
    },
    shouldSeed: (context) => context.isWorkspaceCreator,
  },
  {
    status: OnboardingStatus.PLAN_REQUIRED,
    route: AppPath.PlanRequired,
    skippable: false,
    isToggleable: false,
    source: { type: 'billing' },
    shouldSeed: () => false,
  },
];
