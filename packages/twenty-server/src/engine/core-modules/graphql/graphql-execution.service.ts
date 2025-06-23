import { Injectable } from '@nestjs/common';
import { graphql } from 'graphql';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { ApiKeyWorkspaceEntity } from 'src/modules/api-key/standard-objects/api-key.workspace-entity';
import { WorkspaceActivationStatus } from 'twenty-shared';

@Injectable()
export class GraphQLExecutionService {
  constructor(
    private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  async executeGraphQL(query: string, variables: any, apiToken: string) {
    try {
      // console.log('Executing GraphQL query:', query);
      // console.log('Variables:', variables);
      // console.log('API Token:', apiToken);
      const payload = this.jwtWrapperService.decode(apiToken, { json: true });
      if (!payload?.workspaceId) {
        throw new Error('No workspace ID found in token');
      }
      // console.log('Payload:', payload);
      const authContext: AuthContext = {
        user: payload.user,
        workspace: {
          id: payload.workspaceId,
          displayName: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          allowImpersonation: false,
          isPublicInviteLinkEnabled: true,
          activationStatus: WorkspaceActivationStatus.ACTIVE,
          metadataVersion: 1,
          databaseUrl: '',
          databaseSchema: '',
          subdomain: '',
          isGoogleAuthEnabled: true,
          isPasswordAuthEnabled: true,
          isMicrosoftAuthEnabled: true,
          isCustomDomainEnabled: false,
        } as Workspace,
        workspaceMemberId: payload.workspaceMemberId,
        userWorkspaceId: payload.userWorkspaceId,
        apiKey: Object.assign(new ApiKeyWorkspaceEntity(), {
          id: 'system',
          name: 'System API Key',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Expires in 1 year
          revokedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          workspaceId: payload.workspaceId,
        }),
      };
      // console.log('Auth Context:', authContext);
      const schema = await this.workspaceSchemaFactory.createGraphQLSchema(authContext);
      // console.log('Schema:', schema);
      const result = await graphql({
        schema,
        source: query,
        variableValues: variables,
        contextValue: {
          req: {
            user: payload.user,
            workspace: {
              id: payload.workspaceId,
            },
            workspaceMemberId: payload.workspaceMemberId,
          },
          authContext,
        },
      });
      // console.log('Result:', result);
      return {
        data: result,
      };
    } catch (error) {
      console.error('Error executing GraphQL query:', error);
      throw error;
    }
  }
} 


// import { Injectable } from '@nestjs/common';

// import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
// import { WorkspaceSchemaFactory } from './workspace-schema.factory';

// @Injectable()
// export class GraphQLExecutionService {
//   constructor(
//     private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
//     private readonly jwtWrapperService: JwtWrapperService,
//   ) {}

//   async executeGraphQL(query: string, variables: any, apiToken: string) {
//     // Implementation of GraphQL execution logic
//     // This can be implemented based on your specific needs
//     const decodedToken = await this.jwtWrapperService.decode(apiToken);
//     const schema = await this.workspaceSchemaFactory.createGraphQLSchema(decodedToken);
    
//     // Add your GraphQL execution logic here
//     return { schema, query, variables };
//   }
// } 