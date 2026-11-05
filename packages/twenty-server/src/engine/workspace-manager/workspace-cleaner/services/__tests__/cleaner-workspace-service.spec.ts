import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { BillingSubscriptionEntity } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { getWorkspaceScopedRepositoryToken } from 'src/engine/twenty-orm/workspace-scoped-repository/get-workspace-scoped-repository-token.util';
import { CleanerWorkspaceService } from 'src/engine/workspace-manager/workspace-cleaner/services/cleaner.workspace-service';

const CREATED_ABANDONED_WORKSPACE_ID = 'created-workspace-id';

const buildWorkspace = (id: string) => ({
  id,
  displayName: 'Workspace',
  activationStatus: WorkspaceActivationStatus.CREATED,
  createdAt: new Date('2026-08-05T00:00:00Z'),
  deletedAt: null,
});

describe('CleanerWorkspaceService.batchCleanOnboardingWorkspaces', () => {
  let service: CleanerWorkspaceService;
  let workspaceRepository: {
    find: jest.Mock;
  };
  let userWorkspaceRepository: {
    find: jest.Mock;
  };
  let billingSubscriptionRepository: {
    findOne: jest.Mock;
  };
  let workspaceService: {
    deleteWorkspace: jest.Mock;
    handleRemoveWorkspaceMember: jest.Mock;
  };
  let billingSubscriptionService: {
    assertSubscriptionCanceledOrNone: jest.Mock;
    cancelSubscription: jest.Mock;
  };

  const setup = async ({
    isBillingEnabled,
    subscription,
    userWorkspaces,
  }: {
    isBillingEnabled: boolean;
    subscription: object | null;
    userWorkspaces: object[];
  }) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanerWorkspaceService,
        {
          provide: getRepositoryToken(WorkspaceEntity),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(UserWorkspaceEntity),
          useValue: { find: jest.fn() },
        },
        {
          provide: TwentyConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, unknown> = {
                IS_BILLING_ENABLED: isBillingEnabled,
                WORKSPACE_INACTIVE_DAYS_BEFORE_NOTIFICATION: 7,
                WORKSPACE_INACTIVE_DAYS_BEFORE_SOFT_DELETION: 14,
                WORKSPACE_INACTIVE_DAYS_BEFORE_DELETION: 21,
                MAX_NUMBER_OF_WORKSPACES_DELETED_PER_EXECUTION: 5,
              };

              return values[key];
            }),
          },
        },
        { provide: UserVarsService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: EmailService, useValue: {} },
        {
          provide: BillingSubscriptionService,
          useValue: {
            assertSubscriptionCanceledOrNone: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
        { provide: I18nService, useValue: {} },
        { provide: MetricsService, useValue: {} },
        { provide: WorkspaceDomainsService, useValue: {} },
        {
          provide: getWorkspaceScopedRepositoryToken(BillingSubscriptionEntity),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: WorkspaceService,
          useValue: {
            deleteWorkspace: jest.fn(),
            handleRemoveWorkspaceMember: jest.fn(),
          },
        },
      ],
    })
      .overrideProvider(CleanerWorkspaceService)
      .useClass(CleanerWorkspaceService)
      .compile();

    service = module.get(CleanerWorkspaceService);
    workspaceRepository = module.get(getRepositoryToken(WorkspaceEntity));
    userWorkspaceRepository = module.get(
      getRepositoryToken(UserWorkspaceEntity),
    );
    billingSubscriptionRepository = module.get(
      getWorkspaceScopedRepositoryToken(BillingSubscriptionEntity),
    );
    workspaceService = module.get(WorkspaceService);
    billingSubscriptionService = module.get(BillingSubscriptionService);

    workspaceRepository.find.mockResolvedValue([
      buildWorkspace(CREATED_ABANDONED_WORKSPACE_ID),
    ]);
    userWorkspaceRepository.find.mockResolvedValue(userWorkspaces);
    billingSubscriptionRepository.findOne.mockResolvedValue(subscription);
    workspaceService.deleteWorkspace.mockResolvedValue(undefined);
  };

  it('keeps a CREATED workspace that has an active subscription', async () => {
    await setup({
      isBillingEnabled: true,
      subscription: { id: 'sub-id', status: 'trialing' },
      userWorkspaces: [{ id: 'uw-id' }],
    });

    await service.batchCleanOnboardingWorkspaces([
      CREATED_ABANDONED_WORKSPACE_ID,
    ]);

    expect(workspaceService.deleteWorkspace).not.toHaveBeenCalled();
    expect(
      billingSubscriptionService.cancelSubscription,
    ).not.toHaveBeenCalled();
  });

  it('keeps a CREATED workspace whose members were removed', async () => {
    await setup({
      isBillingEnabled: true,
      subscription: null,
      userWorkspaces: [{ id: 'uw-id', deletedAt: new Date() }],
    });

    await service.batchCleanOnboardingWorkspaces([
      CREATED_ABANDONED_WORKSPACE_ID,
    ]);

    expect(workspaceService.deleteWorkspace).not.toHaveBeenCalled();
  });

  it('soft deletes a CREATED workspace with no subscription and no members', async () => {
    await setup({
      isBillingEnabled: true,
      subscription: null,
      userWorkspaces: [],
    });

    await service.batchCleanOnboardingWorkspaces([
      CREATED_ABANDONED_WORKSPACE_ID,
    ]);

    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(
      CREATED_ABANDONED_WORKSPACE_ID,
      true,
    );
  });

  it('ignores subscriptions when billing is disabled', async () => {
    await setup({
      isBillingEnabled: false,
      subscription: { id: 'sub-id', status: 'trialing' },
      userWorkspaces: [],
    });

    await service.batchCleanOnboardingWorkspaces([
      CREATED_ABANDONED_WORKSPACE_ID,
    ]);

    expect(billingSubscriptionRepository.findOne).not.toHaveBeenCalled();
    expect(workspaceService.deleteWorkspace).toHaveBeenCalledWith(
      CREATED_ABANDONED_WORKSPACE_ID,
      true,
    );
  });
});
