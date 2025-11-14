import { Injectable } from '@nestjs/common';
import { graphql } from 'graphql';
import { GraphqlQueryRunnerException, GraphqlQueryRunnerExceptionCode } from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { ApiKeyWorkspaceEntity } from 'src/modules/api-key/standard-objects/api-key.workspace-entity';
import { WorkspaceActivationStatus } from 'twenty-shared';
import { SchemaCacheService } from './services/schema-cache.service';

const QUERY_TIMEOUT_MS = 15000;

@Injectable()
export class GraphQLExecutionService {
  constructor(
    private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly schemaCacheService: SchemaCacheService,
    private readonly workspaceCacheStorageService: WorkspaceCacheStorageService,
  ) {}

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`GraphQL query timed out after ${ms}ms`));
      }, ms);
    });
  }

  private extractRequiredObjects(query: string): string[] {
    const objectPattern = /(?:query|mutation)\s+\w*\s*(?:\([^)]*\))?\s*{\s*(\w+)/g;
    const objects = new Set<string>();
    let match;

    while ((match = objectPattern.exec(query)) !== null) {
      objects.add(match[1]);
    }

    // Parse nested objects from the query
    const nestedPattern = /(\w+)\s*(?:\([^)]*\))?\s*{/g;
    while ((match = nestedPattern.exec(query)) !== null) {
      objects.add(match[1]);
    }

    return Array.from(objects);
  }

  async executeGraphQL(query: string, variables: any, apiToken: string) {
    const startTime = performance.now();
    try {
      const operationMatch = query.match(/(?:query|mutation)\s+(\w+)\s*\(/);
      const operationName = operationMatch ? operationMatch[1] : 'UnknownOperation';
      const tokenStartTime = performance.now();
      // console.log('GraphQLExecutionService - apiToken length:', apiToken?.length);
      // console.log('GraphQLExecutionService - apiToken preview:', apiToken?.substring(0, 50) + '...');
      // console.log('GraphQLExecutionService - apiToken type:', typeof apiToken);
      
      // Try to verify as API key first
      let payload;
      try {
        // Try to verify as ACCESS token first
        payload = this.jwtWrapperService.verifyWorkspaceToken(apiToken, 'ACCESS');
        // console.log('GraphQLExecutionService - Token verified as ACCESS');
      } catch (accessError) {
        // console.log('GraphQLExecutionService - ACCESS verification failed:', accessError.message);
        try {
          // Try to verify as API_KEY token
          payload = this.jwtWrapperService.verifyWorkspaceToken(apiToken, 'API_KEY');
          // console.log('GraphQLExecutionService - Token verified as API_KEY');
        } catch (apiKeyError) {
          // console.log('GraphQLExecutionService - API_KEY verification failed:', apiKeyError.message);
          console.warn('GraphQLExecutionService - Token verification failed, falling back to decode:', apiKeyError.message);
          // Fallback to decode method
          const decodedPayload = this.jwtWrapperService.decode(apiToken, { json: true });
          // console.log('GraphQLExecutionService - decodedPayload:', decodedPayload);
          if (!decodedPayload?.workspaceId) {
            console.error('GraphQLExecutionService - No workspace ID found in decoded payload:', decodedPayload);
            throw new Error('No workspace ID found in token');
          }
          payload = decodedPayload;
        }
      }
      // console.log(`Token decoded in ${(performance.now() - tokenStartTime).toFixed(2)}ms for ${operationName} payload.workspaceId::`, payload.workspaceId);
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

      // console.log(`Auth context for ${operationName} created in ${(performance.now() - contextStartTime).toFixed(2)}ms for payload.workspaceId::`, payload.workspaceId);
      
      const schemaStartTime = performance.now();
      let currentMetadataVersion = await this.workspaceCacheStorageService.getMetadataVersion(
        payload.workspaceId,
      );
      
      if (currentMetadataVersion === undefined) {
        // console.log(`Metadata version not found for workspace ${payload.workspaceId}, initializing...`);
        currentMetadataVersion = await this.initializeWorkspaceMetadataCache(payload.workspaceId, authContext);
      }

      let schema;
      let schemaType;
      const cachedSchema = this.schemaCacheService.getSchema(payload.workspaceId);
      if (cachedSchema && cachedSchema.metadataVersion === currentMetadataVersion) {
        schema = cachedSchema.schema;
        schemaType = 'cached';
        // console.log('Using cached schema for payload workspaceId::', payload.workspaceId);
      } else {
        schema = await this.workspaceSchemaFactory.createGraphQLSchema(authContext);
        this.schemaCacheService.setSchema(payload.workspaceId, schema, currentMetadataVersion);
        schemaType = 'new';
        // console.log('Created and cached new schema for payload.workspaceId::', payload.workspaceId);
      }
      
      // console.log(`Schema for ${operationName} got through ${schemaType} mechanism in ${(performance.now() - schemaStartTime).toFixed(2)}ms for payload.workspaceId::`, payload.workspaceId, schemaType);
      
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
      
      const result = await Promise.race([
        queryExecution,
        this.createTimeout(QUERY_TIMEOUT_MS),
      ]);
      
      // console.log(`Query for ${operationName} executed in ${(performance.now() - queryStartTime).toFixed(2)}ms for payload.workspaceId::`, payload.workspaceId);
      
      // Check for GraphQL errors in the result
      if (result.errors && result.errors.length > 0) {
        const errorTime = performance.now() - startTime;
        console.error(`[GraphQLExecutionService] GraphQL errors detected for operation ${operationName} after ${errorTime.toFixed(2)}ms:`);
        result.errors.forEach((error, index) => {
          console.error(`[GraphQLExecutionService] Error ${index + 1}:`, {
            message: error.message,
            path: error.path,
            locations: error.locations,
            extensions: error.extensions,
            stack: error.stack,
          });
        });
        console.error(`[GraphQLExecutionService] Query that caused errors:`, query);
        console.error(`[GraphQLExecutionService] Variables used:`, JSON.stringify(variables, null, 2));
      }
      
      const totalTime = performance.now() - startTime;
      // console.log(`Total execution time: ${totalTime.toFixed(2)}ms for ${operationName} for payload.workspaceId::`, payload.workspaceId);
      
      return {
        data: result,
        metrics: {
          totalExecutionTime: totalTime,
          usedCachedSchema: Boolean(cachedSchema && cachedSchema.metadataVersion === currentMetadataVersion),
        },
      };
    } catch (error) {
      const errorTime = performance.now() - startTime;
      if (error.message?.includes('timed out')) {
        // console.log(`Query timed out after ${errorTime.toFixed(2)}ms. Query was:`, query);
      } else {
        // console.log(`Error executing GraphQL query after ${errorTime.toFixed(2)}ms:`, error);
      }
      throw error;
    }
  }

  private async initializeWorkspaceMetadataCache(workspaceId: string, authContext: AuthContext): Promise<number> {
    try {
      const initialVersion = 1;
      await this.workspaceCacheStorageService.setMetadataVersion(workspaceId, initialVersion);
      
      const schema = await this.workspaceSchemaFactory.createGraphQLSchema(authContext);
      this.schemaCacheService.setSchema(workspaceId, schema, initialVersion);
      
      // console.log(`Initialized metadata cache for workspace ${workspaceId} with version ${initialVersion}`);
      return initialVersion;
    } catch (error) {
      console.error(`Failed to initialize metadata cache for workspace ${workspaceId}:`, error);
      throw new GraphqlQueryRunnerException(
        `Failed to initialize metadata cache: ${error.message}`,
        GraphqlQueryRunnerExceptionCode.METADATA_CACHE_VERSION_NOT_FOUND,
      );
    }
  }
}