import { Injectable } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import { type JwtPayload } from 'src/engine/core-modules/auth/types/jwt-payload.type';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

import { GraphQLExecutionService } from './graphql-execution.service';

type WorkspaceScopedTokenPayload = {
  sub?: string;
  userId?: string;
  workspaceId?: string;
  workspaceMemberId?: string;
};

@Injectable()
export class StaticGraphQLService {
  constructor(private moduleRef: ModuleRef) {}

  async executeGraphQL(
    query: string,
    variables: unknown,
    apiToken: string,
  ): Promise<unknown> {
    const contextId = ContextIdFactory.create();

    const graphQLExecutionService = await this.moduleRef.resolve(
      GraphQLExecutionService,
      contextId,
      { strict: false },
    );

    return graphQLExecutionService.executeGraphQL(query, variables, apiToken);
  }

  async getCurrentUser(apiToken: string): Promise<unknown> {
    const jwtWrapperService = this.moduleRef.get(JwtWrapperService, {
      strict: false,
    });

    let payload: WorkspaceScopedTokenPayload;

    try {
      payload = (await jwtWrapperService.verifyJwtToken(
        apiToken,
      )) as JwtPayload & WorkspaceScopedTokenPayload;
    } catch {
      payload = (jwtWrapperService.decode(apiToken, {
        json: true,
      }) ?? {}) as WorkspaceScopedTokenPayload;
    }

    const userId = payload.userId ?? payload.sub;
    const workspaceId = payload.workspaceId;
    const workspaceMemberId = payload.workspaceMemberId;

    if (!isDefined(userId) || !isDefined(workspaceId)) {
      console.warn(
        '[StaticGraphQLService] getCurrentUser: could not extract userId/workspaceId from token',
      );

      return null;
    }

    const userRepository = this.moduleRef.get<Repository<UserEntity>>(
      getRepositoryToken(UserEntity, 'core'),
      { strict: false },
    );
    const workspaceRepository = this.moduleRef.get<
      Repository<WorkspaceEntity>
    >(getRepositoryToken(WorkspaceEntity, 'core'), { strict: false });
    const userWorkspaceRepository = this.moduleRef.get<
      Repository<UserWorkspaceEntity>
    >(getRepositoryToken(UserWorkspaceEntity, 'core'), { strict: false });

    const [user, workspace, userWorkspaces] = await Promise.all([
      userRepository.findOne({ where: { id: userId } }),
      workspaceRepository.findOne({ where: { id: workspaceId } }),
      userWorkspaceRepository.find({
        where: { userId },
        relations: ['workspace'],
      }),
    ]);

    return {
      id: userId,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      workspaceMember: { id: workspaceMemberId },
      currentWorkspace: {
        id: workspaceId,
        subdomain: workspace?.subdomain ?? '',
        displayName: workspace?.displayName ?? '',
      },
      workspaces: userWorkspaces.map((userWorkspace) => ({
        workspace: userWorkspace.workspace,
      })),
    };
  }
}
