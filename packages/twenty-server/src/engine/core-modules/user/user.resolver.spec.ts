import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';

import { UserResolver } from './user.resolver';

describe('UserResolver', () => {
  const workspace = {
    id: 'workspace-id',
    activationStatus: WorkspaceActivationStatus.ACTIVE,
  } as unknown as WorkspaceEntity;

  const user = { id: 'user-id' } as unknown as UserEntity;

  const healthyWorkspaceMember = {
    id: 'workspace-member-id',
    userId: 'user-id',
  };

  const orphanWorkspaceMember = {
    id: 'orphan-workspace-member-id',
    userId: 'deleted-user-id',
  };

  const healthyUserWorkspace = {
    id: 'user-workspace-id',
    userId: 'user-id',
    workspaceId: 'workspace-id',
  };

  const userWorkspaceRoles = [{ id: 'role-id' }];

  const createResolver = ({
    workspaceMembers,
    userWorkspaces = [healthyUserWorkspace],
    rolesByUserWorkspaceId = new Map([
      [healthyUserWorkspace.id, userWorkspaceRoles],
    ]),
  }: {
    workspaceMembers: Array<{ id: string; userId: string }>;
    userWorkspaces?: Array<{
      id: string;
      userId: string;
      workspaceId: string;
    }>;
    rolesByUserWorkspaceId?: Map<string, unknown>;
  }) => {
    const userService = {
      loadWorkspaceMembers: jest.fn().mockResolvedValue(workspaceMembers),
    };

    const userWorkspaceRepository = {
      find: jest.fn().mockResolvedValue(userWorkspaces),
    };

    const userRoleService = {
      getRolesByUserWorkspaces: jest
        .fn()
        .mockResolvedValue(rolesByUserWorkspaceId),
    };

    const workspaceMemberTranspiler = {
      toWorkspaceMemberDtos: jest.fn((args: unknown) => args),
    };

    const resolver = new UserResolver(
      {} as never,
      userService as never,
      {} as never,
      {} as never,
      {} as never,
      userWorkspaceRepository as never,
      userRoleService as never,
      {} as never,
      workspaceMemberTranspiler as never,
      {} as never,
      {} as never,
    );

    return { resolver, workspaceMemberTranspiler };
  };

  it('should return workspace members that have a user workspace and roles', async () => {
    const { resolver, workspaceMemberTranspiler } = createResolver({
      workspaceMembers: [healthyWorkspaceMember],
    });

    const result = await resolver.workspaceMembers(user, workspace);

    expect(
      workspaceMemberTranspiler.toWorkspaceMemberDtos,
    ).toHaveBeenCalledWith([
      {
        workspaceMemberEntity: healthyWorkspaceMember,
        userWorkspace: healthyUserWorkspace,
        userWorkspaceRoles,
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should skip orphaned workspace members instead of failing the whole query', async () => {
    const { resolver, workspaceMemberTranspiler } = createResolver({
      workspaceMembers: [healthyWorkspaceMember, orphanWorkspaceMember],
    });

    const result = await resolver.workspaceMembers(user, workspace);

    expect(
      workspaceMemberTranspiler.toWorkspaceMemberDtos,
    ).toHaveBeenCalledWith([
      {
        workspaceMemberEntity: healthyWorkspaceMember,
        userWorkspace: healthyUserWorkspace,
        userWorkspaceRoles,
      },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should skip workspace members whose user workspace has no roles', async () => {
    const { resolver, workspaceMemberTranspiler } = createResolver({
      workspaceMembers: [healthyWorkspaceMember],
      rolesByUserWorkspaceId: new Map(),
    });

    await resolver.workspaceMembers(user, workspace);

    expect(
      workspaceMemberTranspiler.toWorkspaceMemberDtos,
    ).toHaveBeenCalledWith([]);
  });
});
