import { Test, TestingModule } from '@nestjs/testing';

import { WorkspaceActivationStatus } from 'twenty-shared';

import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
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
  let userVarsService: UserVarsService<{
    [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING]: boolean;
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
          provide: UserVarsService,
          useValue: {
            getAll: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
    billingService = module.get<BillingService>(BillingService);
    userVarsService = module.get(UserVarsService);
  });

  describe('getOnboardingStatus', () => {
    it('should return WORKSPACE_ACTIVATION when no subscription', async () => {
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(false);

      const result = await service.getOnboardingStatus(
        user,
        workspacePendingCreation,
      );

      expect(result).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
    });

    it('should return WORKSPACE_ACTIVATION when no subscription even if workspace is not PENDING_CREATION', async () => {
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(false);

      const result = await service.getOnboardingStatus(user, workspaceActive);

      expect(result).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
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
    });

    it('should return CONNECT_LINKEDIN when connect linkedin is pending', async () => {
      jest
        .spyOn(billingService, 'hasWorkspaceAnySubscription')
        .mockResolvedValue(true);
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;
      jest.spyOn(userVarsService, 'getAll').mockResolvedValue(
        new Map([[OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING, true]]),
      );

      const result = await service.getOnboardingStatus(user, workspaceActive);

      expect(result).toBe(OnboardingStatus.CONNECT_LINKEDIN);
    });

  });
});
