import { Test, type TestingModule } from '@nestjs/testing';

import { FieldActorSource } from 'twenty-shared/types';

import { WorkspaceMemberProfileProvisioningService } from 'src/engine/core-modules/user-workspace/workspace-member-profile-provisioning.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';

describe('WorkspaceMemberProfileProvisioningService', () => {
  let service: WorkspaceMemberProfileProvisioningService;
  let globalWorkspaceOrmManager: GlobalWorkspaceOrmManager;
  let profileRepository: {
    findOne: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    profileRepository = {
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceMemberProfileProvisioningService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest
              .fn()
              .mockImplementation(async (callback: () => unknown) =>
                callback(),
              ),
            getRepository: jest.fn().mockResolvedValue(profileRepository),
          },
        },
      ],
    }).compile();

    service = module.get(WorkspaceMemberProfileProvisioningService);
    globalWorkspaceOrmManager = module.get(GlobalWorkspaceOrmManager);
  });

  it('should insert a recruiter profile when none exists', async () => {
    profileRepository.findOne.mockResolvedValue(null);

    await service.ensureWorkspaceMemberProfileForNewMember(
      'workspace-id',
      'member-id',
      {
        name: { firstName: 'Jane', lastName: 'Doe' },
        userEmail: 'jane@example.com',
      },
    );

    expect(profileRepository.insert).toHaveBeenCalledWith({
      workspaceMemberId: 'member-id',
      typeWorkspaceMember: 'RECRUITER_TYPE',
      createdBy: {
        source: FieldActorSource.SYSTEM,
        name: 'System',
        workspaceMemberId: null,
        context: {},
      },
      updatedBy: {
        source: FieldActorSource.SYSTEM,
        name: 'System',
        workspaceMemberId: null,
        context: {},
      },
      name: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phoneNumber: '',
    });
  });

  it('should not insert when a profile already exists', async () => {
    profileRepository.findOne.mockResolvedValue({ id: 'profile-id' });

    await service.ensureWorkspaceMemberProfileForNewMember(
      'workspace-id',
      'member-id',
    );

    expect(profileRepository.insert).not.toHaveBeenCalled();
  });

  it('should no-op when workspaceMemberProfile is unavailable', async () => {
    (globalWorkspaceOrmManager.getRepository as jest.Mock).mockRejectedValue(
      new Error('Object not found'),
    );

    await service.ensureWorkspaceMemberProfileForNewMember(
      'workspace-id',
      'member-id',
    );

    expect(profileRepository.insert).not.toHaveBeenCalled();
  });

  it('should ensure then update profile fields on sync', async () => {
    profileRepository.findOne.mockResolvedValue({ id: 'profile-id' });

    await service.syncWorkspaceMemberProfileFromWorkspaceMemberData(
      'workspace-id',
      'member-id',
      {
        name: { firstName: 'John', lastName: 'Smith' },
        userEmail: 'john@example.com',
      },
    );

    expect(profileRepository.update).toHaveBeenCalledWith(
      { workspaceMemberId: 'member-id' },
      {
        name: 'John Smith',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        phoneNumber: '',
      },
    );
  });
});
