import { Injectable } from '@nestjs/common';
import { graphql } from 'graphql';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { ApiKeyWorkspaceEntity } from 'src/modules/api-key/standard-objects/api-key.workspace-entity';
import { WorkspaceActivationStatus } from 'twenty-shared';

const QUERY_TIMEOUT_MS = 15000; // 30 seconds timeout

@Injectable()
export class GraphQLExecutionService {
  constructor(
    private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
    private readonly jwtWrapperService: JwtWrapperService,
  ) {}

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`GraphQL query timed out after ${ms}ms`));
      }, ms);
    });
  }

  async executeGraphQL(query: string, variables: any, apiToken: string) {
    const startTime = performance.now();
    try {
      console.log('Starting GraphQL execution...');
      
      // Token decoding timing
      const tokenStartTime = performance.now();
      const payload = this.jwtWrapperService.decode(apiToken, { json: true });
      if (!payload?.workspaceId) {
        throw new Error('No workspace ID found in token');
      }
      console.log(`Token decoded in ${(performance.now() - tokenStartTime).toFixed(2)}ms`);

      // Auth context creation timing
      const contextStartTime = performance.now();
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
          name: 'System',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          revokedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          workspaceId: payload.workspaceId,
        }),
      };
      console.log(`Auth context created in ${(performance.now() - contextStartTime).toFixed(2)}ms`);

      // Schema creation timing
      const schemaStartTime = performance.now();
      const schema = await this.workspaceSchemaFactory.createGraphQLSchema(authContext);
      console.log(`Schema created in ${(performance.now() - schemaStartTime).toFixed(2)}ms`);

      // Query execution timing with timeout
      const queryStartTime = performance.now();
      const queryExecution = graphql({
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

      // Race between query execution and timeout
      const result = await Promise.race([
        queryExecution,
        this.createTimeout(QUERY_TIMEOUT_MS),
      ]);

      console.log(`Query executed in ${(performance.now() - queryStartTime).toFixed(2)}ms`);

      const totalTime = performance.now() - startTime;
      console.log(`Total execution time: ${totalTime.toFixed(2)}ms for query::`, query);

      return {
        data: result,
        metrics: {
          totalExecutionTime: totalTime,
        },
      };
    } catch (error) {
      const errorTime = performance.now() - startTime;
      if (error.message?.includes('timed out')) {
        console.error(`Query timed out after ${errorTime.toFixed(2)}ms. Query was:`, query);
      } else {
        console.error(`Error executing GraphQL query after ${errorTime.toFixed(2)}ms:`, error);
      }
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