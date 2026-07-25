import { Injectable } from '@nestjs/common';

import { graphql } from 'graphql';
import { msg } from '@lingui/core/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { CoreEntityCacheService } from 'src/engine/core-entity-cache/services/core-entity-cache.service';
import { withWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { type JwtPayload } from 'src/engine/core-modules/auth/types/jwt-payload.type';
import { type SystemWorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildSystemAuthContext } from 'src/engine/core-modules/auth/utils/build-system-auth-context.util';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { type FlatWorkspace } from 'src/engine/core-modules/workspace/types/flat-workspace.type';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { SchemaCacheService } from './services/schema-cache.service';

const QUERY_TIMEOUT_MS = 15000;

type WorkspaceScopedTokenPayload = {
  workspaceId: string;
  workspaceMemberId?: string;
  userWorkspaceId?: string;
  userId?: string;
  user?: AuthContext['user'];
};

@Injectable()
export class GraphQLExecutionService {
  constructor(
    private readonly workspaceSchemaFactory: WorkspaceSchemaFactory,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly schemaCacheService: SchemaCacheService,
    private readonly workspaceCacheStorageService: WorkspaceCacheStorageService,
    private readonly coreEntityCacheService: CoreEntityCacheService,
  ) {}

  private createTimeout(milliseconds: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`GraphQL query timed out after ${milliseconds}ms`));
      }, milliseconds);
    });
  }

  private async resolveTokenPayload(
    apiToken: string,
  ): Promise<WorkspaceScopedTokenPayload> {
    try {
      const verifiedPayload = (await this.jwtWrapperService.verifyJwtToken(
        apiToken,
      )) as JwtPayload & WorkspaceScopedTokenPayload;

      if (!isDefined(verifiedPayload.workspaceId)) {
        throw new Error('No workspace ID found in token');
      }

      return verifiedPayload;
    } catch (verificationError) {
      const decodedPayload = this.jwtWrapperService.decode(apiToken, {
        json: true,
      }) as WorkspaceScopedTokenPayload | null;

      if (!isDefined(decodedPayload?.workspaceId)) {
        console.warn(
          'GraphQLExecutionService - Token verification failed, decode fallback missing workspaceId:',
          verificationError instanceof Error
            ? verificationError.message
            : verificationError,
        );
        throw new Error('No workspace ID found in token');
      }

      return decodedPayload;
    }
  }

  private async resolveWorkspace(
    workspaceId: string,
  ): Promise<FlatWorkspace> {
    const workspace = await this.coreEntityCacheService.get(
      'workspaceEntity',
      workspaceId,
    );

    if (!isDefined(workspace)) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!isNonEmptyString(workspace.databaseSchema)) {
      throw new Error(
        `Workspace ${workspaceId} has no databaseSchema; cannot build GraphQL schema`,
      );
    }

    return workspace;
  }

  private buildWorkspaceAuthContext(
    workspace: FlatWorkspace,
  ): SystemWorkspaceAuthContext {
    return buildSystemAuthContext({ workspace });
  }

  async executeGraphQL(query: string, variables: unknown, apiToken: string) {
    const startTime = performance.now();

    try {
      const payload = await this.resolveTokenPayload(apiToken);
      const workspace = await this.resolveWorkspace(payload.workspaceId);
      const workspaceAuthContext = this.buildWorkspaceAuthContext(workspace);

      let currentMetadataVersion =
        await this.workspaceCacheStorageService.getMetadataVersion(
          payload.workspaceId,
        );

      if (currentMetadataVersion === undefined) {
        currentMetadataVersion = await this.initializeWorkspaceMetadataCache(
          payload.workspaceId,
          workspace,
        );
      }

      const cachedSchema = this.schemaCacheService.getSchema(
        payload.workspaceId,
      );

      let schema;
      let usedCachedSchema = false;

      if (
        isDefined(cachedSchema) &&
        cachedSchema.metadataVersion === currentMetadataVersion &&
        isDefined(cachedSchema.schema.getQueryType())
      ) {
        schema = cachedSchema.schema;
        usedCachedSchema = true;
      } else {
        if (isDefined(cachedSchema)) {
          this.schemaCacheService.invalidateSchema(payload.workspaceId);
        }

        schema =
          await this.workspaceSchemaFactory.createGraphQLSchema(workspace);
        this.schemaCacheService.setSchema(
          payload.workspaceId,
          schema,
          currentMetadataVersion,
        );
      }

      // Resolvers read auth from AsyncLocalStorage (same as HTTP middleware path)
      const result = await withWorkspaceAuthContext(
        workspaceAuthContext,
        async () => {
          const queryExecution = graphql({
            schema,
            source: query,
            variableValues: variables as Record<string, unknown> | undefined,
            contextValue: {
              req: {
                user: payload.user,
                workspace,
                workspaceMemberId: payload.workspaceMemberId,
              },
              authContext: workspaceAuthContext,
            },
          });

          return Promise.race([
            queryExecution,
            this.createTimeout(QUERY_TIMEOUT_MS),
          ]);
        },
      );

      if (result.errors && result.errors.length > 0) {
        const errorTime = performance.now() - startTime;

        console.error(
          `[GraphQLExecutionService] GraphQL errors after ${errorTime.toFixed(2)}ms:`,
        );
        result.errors.forEach((error, index) => {
          console.error(`[GraphQLExecutionService] Error ${index + 1}:`, {
            message: error.message,
            path: error.path,
            locations: error.locations,
            extensions: error.extensions,
          });
        });
      }

      const totalTime = performance.now() - startTime;

      return {
        data: result,
        metrics: {
          totalExecutionTime: totalTime,
          usedCachedSchema,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  private async initializeWorkspaceMetadataCache(
    workspaceId: string,
    workspace: FlatWorkspace,
  ): Promise<number> {
    try {
      const initialVersion = 1;

      await this.workspaceCacheStorageService.setMetadataVersion(
        workspaceId,
        initialVersion,
      );

      const schema =
        await this.workspaceSchemaFactory.createGraphQLSchema(workspace);

      this.schemaCacheService.setSchema(workspaceId, schema, initialVersion);

      return initialVersion;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `Failed to initialize metadata cache for workspace ${workspaceId}:`,
        error,
      );
      throw new GraphqlQueryRunnerException(
        `Failed to initialize metadata cache: ${errorMessage}`,
        GraphqlQueryRunnerExceptionCode.INVALID_QUERY_INPUT,
        {
          userFriendlyMessage: msg`Failed to initialize workspace GraphQL metadata cache`,
        },
      );
    }
  }
}
