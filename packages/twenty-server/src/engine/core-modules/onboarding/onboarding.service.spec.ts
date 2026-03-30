import { Test, TestingModule } from '@nestjs/testing';

import { WorkspaceActivationStatus } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { OnboardingIntentPath } from 'src/engine/core-modules/onboarding/enums/onboarding-intent-path.enum';
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
  let userVarsService: UserVarsService<{
    [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING]: boolean;
    [OnboardingStepKeys.ONBOARDING_INTENT_PATH]: OnboardingIntentPath;
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
          provide: EnvironmentService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'USE_CONNECT_LINKEDIN_ONBOARDING') {
                return true;
              }
              if (key === 'USE_INTENT_CHOICE_ONBOARDING') {
                return false;
              }
              return undefined;
            }),
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
    userVarsService = module.get(UserVarsService);
  });

  describe('getOnboardingStatus', () => {
    it('should return WORKSPACE_ACTIVATION when workspace is PENDING_CREATION', async () => {
      const result = await service.getOnboardingStatus(
        user,
        workspacePendingCreation,
      );

      expect(result).toBe(OnboardingStatus.WORKSPACE_ACTIVATION);
    });

    it('should return CONNECT_LINKEDIN when connect linkedin is pending and flag is true', async () => {
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

    it('should return SYNC_EMAIL when connect linkedin is pending but flag is false', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OnboardingService,
          {
            provide: EnvironmentService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'USE_CONNECT_LINKEDIN_ONBOARDING') {
                  return false;
                }
                if (key === 'USE_INTENT_CHOICE_ONBOARDING') {
                  return false;
                }
                return undefined;
              }),
            },
          },
          {
            provide: UserVarsService,
            useValue: {
              getAll: jest.fn().mockResolvedValue(
                new Map([
                  [OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING, true],
                  [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING, true],
                ]),
              ),
            },
          },
        ],
      }).compile();

      const serviceWithFlagDisabled = module.get<OnboardingService>(
        OnboardingService,
      );
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;

      const result = await serviceWithFlagDisabled.getOnboardingStatus(
        user,
        workspaceActive,
      );

      expect(result).toBe(OnboardingStatus.SYNC_EMAIL);
    });

    it('should return INTENT_CHOICE when intent onboarding is pending and enabled', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OnboardingService,
          {
            provide: EnvironmentService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'USE_INTENT_CHOICE_ONBOARDING') {
                  return true;
                }
                return false;
              }),
            },
          },
          {
            provide: UserVarsService,
            useValue: {
              getAll: jest.fn().mockResolvedValue(
                new Map([
                  [OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING, true],
                ]),
              ),
            },
          },
        ],
      }).compile();

      const intentEnabledService = module.get<OnboardingService>(
        OnboardingService,
      );
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;

      const result = await intentEnabledService.getOnboardingStatus(
        user,
        workspaceActive,
      );

      expect(result).toBe(OnboardingStatus.INTENT_CHOICE);
    });

    it('should return a path-specific status when intent onboarding path is selected', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OnboardingService,
          {
            provide: EnvironmentService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === 'USE_INTENT_CHOICE_ONBOARDING') {
                  return true;
                }
                return false;
              }),
            },
          },
          {
            provide: UserVarsService,
            useValue: {
              getAll: jest.fn().mockResolvedValue(
                new Map([
                  [
                    OnboardingStepKeys.ONBOARDING_INTENT_PATH,
                    OnboardingIntentPath.DEAL_DILIGENCE,
                  ],
                ]),
              ),
            },
          },
        ],
      }).compile();

      const intentEnabledService = module.get<OnboardingService>(
        OnboardingService,
      );
      const workspaceActive = {
        id: 'workspaceId',
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      } as Workspace;

      const result = await intentEnabledService.getOnboardingStatus(
        user,
        workspaceActive,
      );

      expect(result).toBe(OnboardingStatus.DEAL_DILIGENCE);
    });
  });
});
