import { Injectable } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';

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
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly jwtWrapperService: JwtWrapperService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

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
    let payload: WorkspaceScopedTokenPayload;

    try {
      payload = (await this.jwtWrapperService.verifyJwtToken(
        apiToken,
      )) as JwtPayload & WorkspaceScopedTokenPayload;
    } catch {
      payload = (this.jwtWrapperService.decode(apiToken, {
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

    // Default connection (no name) — schema is "core", connection is not named "core"
    try {
      const [user, workspace, userWorkspaces] = await Promise.all([
        this.userRepository.findOne({ where: { id: userId } }),
        this.workspaceRepository.findOne({ where: { id: workspaceId } }),
        this.userWorkspaceRepository.find({
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
    } catch (error) {
      // Keep chrome-extension get_user_obj working even if TypeORM DI is broken
      console.error(
        '[StaticGraphQLService] getCurrentUser repository lookup failed, using JWT payload only:',
        error,
      );

      return {
        id: userId,
        firstName: '',
        lastName: '',
        email: '',
        workspaceMember: { id: workspaceMemberId },
        currentWorkspace: {
          id: workspaceId,
          subdomain: '',
          displayName: '',
        },
        workspaces: [],
      };
    }
  }
}
