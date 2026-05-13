import { Injectable } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import { GraphQLExecutionService } from './graphql-execution.service';

@Injectable()
export class StaticGraphQLService {
  constructor(private moduleRef: ModuleRef) {}

  async executeGraphQL(query: string, variables: any, apiToken: string): Promise<any> {
    const contextId = ContextIdFactory.create();
    
    const graphQLExecutionService = await this.moduleRef.resolve(
      GraphQLExecutionService,
      contextId,
      { strict: false },
    );

    return graphQLExecutionService.executeGraphQL(query, variables, apiToken);
  }

  async getCurrentUser(apiToken: string): Promise<any> {
    const jwtWrapperService = this.moduleRef.get(JwtWrapperService, { strict: false });

    let payload: any;
    try {
      payload = jwtWrapperService.verifyWorkspaceToken(apiToken, 'ACCESS');
    } catch {
      try {
        payload = jwtWrapperService.verifyWorkspaceToken(apiToken, 'API_KEY');
      } catch {
        payload = jwtWrapperService.decode(apiToken, { json: true });
      }
    }

    const userId: string | undefined = payload?.sub;
    const workspaceId: string | undefined = payload?.workspaceId;
    const workspaceMemberId: string | undefined = payload?.workspaceMemberId;

    if (!userId || !workspaceId) {
      console.warn('[StaticGraphQLService] getCurrentUser: could not extract userId/workspaceId from token');
      return null;
    }

    const userRepository = this.moduleRef.get<Repository<User>>(
      getRepositoryToken(User, 'core'),
      { strict: false },
    );
    const workspaceRepository = this.moduleRef.get<Repository<Workspace>>(
      getRepositoryToken(Workspace, 'core'),
      { strict: false },
    );
    const userWorkspaceRepository = this.moduleRef.get<Repository<UserWorkspace>>(
      getRepositoryToken(UserWorkspace, 'core'),
      { strict: false },
    );

    const [user, workspace, userWorkspaces] = await Promise.all([
      userRepository.findOne({ where: { id: userId } }),
      workspaceRepository.findOne({ where: { id: workspaceId } }),
      userWorkspaceRepository.find({ where: { userId }, relations: ['workspace'] }),
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
      workspaces: userWorkspaces.map((uw) => ({ workspace: uw.workspace })),
    };
  }
} 