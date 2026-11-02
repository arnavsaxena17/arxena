import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import {
  DEFAULT_ONBOARDING_ENABLED_STEPS,
  getOnboardingStepsToSeed,
  parseEnabledOnboardingStatuses,
  resolveOnboardingStatus,
} from 'src/engine/core-modules/onboarding/utils/onboarding-steps.util';

const ALL_OPTIONAL_STEPS =
  'PROFILE_CREATION,EXTENSION_INSTALL,SYNC_EMAIL,APPS_INSTALLATION,INVITE_TEAM';

const createPlanRequiredResolver = (isPlanRequired: boolean) =>
  jest.fn().mockResolvedValue(isPlanRequired);

describe('onboarding steps util', () => {
  describe('parseEnabledOnboardingStatuses', () => {
    it('should fall back to the default flow when the setting is unset', () => {
      expect(parseEnabledOnboardingStatuses(undefined)).toEqual(
        new Set([
          ...DEFAULT_ONBOARDING_ENABLED_STEPS,
          OnboardingStatus.WORKSPACE_ACTIVATION,
          OnboardingStatus.PLAN_REQUIRED,
        ]),
      );
    });

    it('should always keep the non-toggleable lifecycle gates', () => {
      const enabledStatuses = parseEnabledOnboardingStatuses(
        'EXTENSION_INSTALL',
      );

      expect(enabledStatuses.has(OnboardingStatus.WORKSPACE_ACTIVATION)).toBe(
        true,
      );
      expect(enabledStatuses.has(OnboardingStatus.PLAN_REQUIRED)).toBe(true);
      expect(enabledStatuses.has(OnboardingStatus.EXTENSION_INSTALL)).toBe(true);
      expect(enabledStatuses.has(OnboardingStatus.PROFILE_CREATION)).toBe(false);
    });

    it('should ignore unknown values and surrounding whitespace', () => {
      const enabledStatuses = parseEnabledOnboardingStatuses(
        ' profile_creation , NOT_A_STEP ',
      );

      expect(enabledStatuses.has(OnboardingStatus.PROFILE_CREATION)).toBe(true);
      expect(enabledStatuses.has(OnboardingStatus.EXTENSION_INSTALL)).toBe(
        false,
      );
    });

    it('should disable every optional step for an empty value', () => {
      const enabledStatuses = parseEnabledOnboardingStatuses('');

      expect(enabledStatuses).toEqual(
        new Set([
          OnboardingStatus.WORKSPACE_ACTIVATION,
          OnboardingStatus.PLAN_REQUIRED,
        ]),
      );
    });
  });

  describe('getOnboardingStepsToSeed', () => {
    it('should seed profile and extension install for the workspace creator', () => {
      const steps = getOnboardingStepsToSeed({
        context: { isWorkspaceCreator: true },
        enabledStatuses: parseEnabledOnboardingStatuses(undefined),
      });

      expect(steps.map((step) => step.status)).toEqual([
        OnboardingStatus.PROFILE_CREATION,
        OnboardingStatus.EXTENSION_INSTALL,
      ]);
    });

    it('should not seed the creator-only steps for an invited member', () => {
      const steps = getOnboardingStepsToSeed({
        context: { isWorkspaceCreator: false },
        enabledStatuses: parseEnabledOnboardingStatuses(ALL_OPTIONAL_STEPS),
      });

      expect(steps.map((step) => step.status)).toEqual([
        OnboardingStatus.PROFILE_CREATION,
        OnboardingStatus.EXTENSION_INSTALL,
      ]);
    });

    it('should seed every enabled step in flow order for the workspace creator', () => {
      const steps = getOnboardingStepsToSeed({
        context: { isWorkspaceCreator: true },
        enabledStatuses: parseEnabledOnboardingStatuses(ALL_OPTIONAL_STEPS),
      });

      expect(steps.map((step) => step.status)).toEqual([
        OnboardingStatus.PROFILE_CREATION,
        OnboardingStatus.EXTENSION_INSTALL,
        OnboardingStatus.SYNC_EMAIL,
        OnboardingStatus.APPS_INSTALLATION,
        OnboardingStatus.INVITE_TEAM,
      ]);
    });

    it('should never return a step that has no pending flag', () => {
      const steps = getOnboardingStepsToSeed({
        context: { isWorkspaceCreator: true },
        enabledStatuses: parseEnabledOnboardingStatuses(ALL_OPTIONAL_STEPS),
      });

      expect(
        steps.every((step) => step.source.type === 'pending-flag'),
      ).toBe(true);
    });
  });

  describe('resolveOnboardingStatus', () => {
    const enabledStatuses = parseEnabledOnboardingStatuses(undefined);

    it('should return WORKSPACE_ACTIVATION before any onboarding step', async () => {
      const isPlanRequired = createPlanRequiredResolver(true);

      const status = await resolveOnboardingStatus({
        pendingKeys: new Set(['ONBOARDING_CREATE_PROFILE_PENDING']),
        enabledStatuses,
        isWorkspaceActivationPending: true,
        isPlanRequired,
      });

      expect(status).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
      expect(isPlanRequired).not.toHaveBeenCalled();
    });

    it('should return the first pending enabled step in flow order', async () => {
      const status = await resolveOnboardingStatus({
        pendingKeys: new Set([
          'ONBOARDING_EXTENSION_INSTALL_PENDING',
          'ONBOARDING_CREATE_PROFILE_PENDING',
        ]),
        enabledStatuses,
        isWorkspaceActivationPending: false,
        isPlanRequired: createPlanRequiredResolver(true),
      });

      expect(status).toBe(OnboardingStatus.PROFILE_CREATION);
    });

    it('should ignore pending flags for disabled steps', async () => {
      const status = await resolveOnboardingStatus({
        pendingKeys: new Set([
          'ONBOARDING_CONNECT_ACCOUNT_PENDING',
          'ONBOARDING_INVITE_TEAM_PENDING',
        ]),
        enabledStatuses,
        isWorkspaceActivationPending: false,
        isPlanRequired: createPlanRequiredResolver(false),
      });

      expect(status).toBe(OnboardingStatus.COMPLETED);
    });

    it('should only consult billing once every other step is cleared', async () => {
      const isPlanRequired = createPlanRequiredResolver(true);

      const status = await resolveOnboardingStatus({
        pendingKeys: new Set(),
        enabledStatuses,
        isWorkspaceActivationPending: false,
        isPlanRequired,
      });

      expect(status).toBe(OnboardingStatus.PLAN_REQUIRED);
      expect(isPlanRequired).toHaveBeenCalledTimes(1);
    });

    it('should complete when billing has a subscription', async () => {
      const status = await resolveOnboardingStatus({
        pendingKeys: new Set(),
        enabledStatuses,
        isWorkspaceActivationPending: false,
        isPlanRequired: createPlanRequiredResolver(false),
      });

      expect(status).toBe(OnboardingStatus.COMPLETED);
    });
  });
});
