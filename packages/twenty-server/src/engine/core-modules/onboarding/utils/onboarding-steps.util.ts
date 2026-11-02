import {
  ONBOARDING_STEPS,
  type OnboardingStepContext,
  type OnboardingStepDefinition,
  type OnboardingStepSource,
} from 'src/engine/core-modules/onboarding/constants/onboarding-steps.constant';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';

// Product flow shipped by default: profile (with optional phone) then
// extension install. Every other optional step stays defined in
// ONBOARDING_STEPS but disabled, so re-enabling one is a configuration change.
export const DEFAULT_ONBOARDING_ENABLED_STEPS: OnboardingStatus[] = [
  OnboardingStatus.PROFILE_CREATION,
  OnboardingStatus.EXTENSION_INSTALL,
];

export type OnboardingSeedableStep = OnboardingStepDefinition & {
  source: Extract<OnboardingStepSource, { type: 'pending-flag' }>;
};

const isSeedableStep = (
  step: OnboardingStepDefinition,
): step is OnboardingSeedableStep => step.source.type === 'pending-flag';

export const parseEnabledOnboardingStatuses = (
  rawEnabledSteps?: string | null,
): Set<OnboardingStatus> => {
  const requested =
    rawEnabledSteps === undefined || rawEnabledSteps === null
      ? DEFAULT_ONBOARDING_ENABLED_STEPS
      : rawEnabledSteps
          .split(',')
          .map((value) => value.trim().toUpperCase())
          .filter((value) => value.length > 0);

  const requestedStatuses = new Set<string>(requested);

  const enabledStatuses = new Set<OnboardingStatus>();

  for (const step of ONBOARDING_STEPS) {
    if (!step.isToggleable || requestedStatuses.has(step.status)) {
      enabledStatuses.add(step.status);
    }
  }

  return enabledStatuses;
};

export const getOnboardingStepsToSeed = ({
  context,
  enabledStatuses,
}: {
  context: OnboardingStepContext;
  enabledStatuses: Set<OnboardingStatus>;
}): OnboardingSeedableStep[] =>
  ONBOARDING_STEPS.filter(
    (step): step is OnboardingSeedableStep =>
      isSeedableStep(step) &&
      enabledStatuses.has(step.status) &&
      step.shouldSeed(context),
  );

export const resolveOnboardingStatus = async ({
  pendingKeys,
  enabledStatuses,
  isWorkspaceActivationPending,
  isPlanRequired,
}: {
  pendingKeys: Set<string>;
  enabledStatuses: Set<OnboardingStatus>;
  isWorkspaceActivationPending: boolean;
  isPlanRequired: () => Promise<boolean>;
}): Promise<OnboardingStatus> => {
  for (const step of ONBOARDING_STEPS) {
    if (!enabledStatuses.has(step.status)) {
      continue;
    }

    // The billing check runs last (PLAN_REQUIRED is the last step) so it stays
    // a single query and is only paid for once every other step is cleared.
    const isPending =
      step.source.type === 'workspace-activation'
        ? isWorkspaceActivationPending
        : step.source.type === 'pending-flag'
          ? pendingKeys.has(step.source.pendingKey)
          : await isPlanRequired();

    if (isPending) {
      return step.status;
    }
  }

  return OnboardingStatus.COMPLETED;
};
