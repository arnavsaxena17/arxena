import { Test, TestingModule } from '@nestjs/testing';

import { WorkspaceActivationStatus } from 'twenty-shared';

import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import {
  OnboardingService,
  OnboardingStepKeys,
} from 'src/engine/core-modules/onboarding/onboarding.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let billingService: BillingService;
  let environmentService: EnvironmentService;
  let userVarsService: UserVarsService<{
    [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING]: boolean;
  }>;

  const user = { id: 'userId' } as User;
  const workspacePendingCreation = {
    id: 'workspaceId',
    activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
  } as Workspace;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        {
          provide: BillingService,
          useValue: {
            hasWorkspaceAnySubscription: jest.fn(),
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UserVarsService,
          useValue: {
            getAll: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    billingService = module.get<BillingService>(BillingService);
    environmentService = module.get<EnvironmentService>(EnvironmentService);
    userVarsService = module.get(UserVarsService);
  });

  describe('getOnboardingStatus', () => {
    it('should return WORKSPACE_ACTIVATION when skip plan required is enabled, no subscription, and workspace is PENDING_CREATION', async () => {
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(false);
      jest
        .spyOn(environmentService, 'get')
        .mockImplementation((key: string) =>
          key === 'SKIP_PLAN_REQUIRED_FOR_ONBOARDING' ? true : undefined,
        );

      const result = await service.getOnboardingStatus(
        user,
        workspacePendingCreation,
      );

      expect(result).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
    });

    it('should return PLAN_REQUIRED when skip plan required is disabled and no subscription', async () => {
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(false);
      jest
        .spyOn(environmentService, 'get')
        .mockImplementation((key: string) =>
          key === 'SKIP_PLAN_REQUIRED_FOR_ONBOARDING' ? false : undefined,
        );

      const result = await service.getOnboardingStatus(
        user,
        workspacePendingCreation,
      );

      expect(result).toBe(OnboardingStatus.PLAN_REQUIRED);
    });

    it('should return PLAN_REQUIRED when skip is enabled but workspace is not PENDING_CREATION and no subscription', async () => {
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(false);
      jest
        .spyOn(environmentService, 'get')
        .mockImplementation((key: string) =>
          key === 'SKIP_PLAN_REQUIRED_FOR_ONBOARDING' ? true : undefined,
        );

      const result = await service.getOnboardingStatus(user, workspaceActive);

      expect(result).toBe(OnboardingStatus.PLAN_REQUIRED);
    });

    it('should return WORKSPACE_ACTIVATION when workspace has subscription and is PENDING_CREATION', async () => {
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(true);

      const result = await service.getOnboardingStatus(
        user,
        workspacePendingCreation,
      );

      expect(result).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
      expect(environmentService.get).not.toHaveBeenCalled();
    });
  });
});
