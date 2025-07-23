import { Injectable } from '@nestjs/common';

import { makeExecutableSchema } from '@graphql-tools/schema';
import chalk from 'chalk';
import { GraphQLSchema, printSchema } from 'graphql';
import { gql } from 'graphql-tag';

import {
  GraphqlQueryRunnerException,
  GraphqlQueryRunnerExceptionCode,
} from 'src/engine/api/graphql/graphql-query-runner/errors/graphql-query-runner.exception';
import { ScalarsExplorerService } from 'src/engine/api/graphql/services/scalars-explorer.service';
import { workspaceResolverBuilderMethodNames } from 'src/engine/api/graphql/workspace-resolver-builder/factories/factories';
import { WorkspaceResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver.factory';
import { WorkspaceGraphQLSchemaFactory } from 'src/engine/api/graphql/workspace-schema-builder/workspace-graphql-schema.factory';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { WorkspaceMetadataCacheService } from 'src/engine/metadata-modules/workspace-metadata-cache/services/workspace-metadata-cache.service';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';

@Injectable()
export class WorkspaceSchemaFactory {
  constructor(
    private readonly dataSourceService: DataSourceService,
    private readonly scalarsExplorerService: ScalarsExplorerService,
    private readonly workspaceGraphQLSchemaFactory: WorkspaceGraphQLSchemaFactory,
    private readonly workspaceResolverFactory: WorkspaceResolverFactory,
    private readonly workspaceCacheStorageService: WorkspaceCacheStorageService,
    private readonly workspaceMetadataCacheService: WorkspaceMetadataCacheService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async createGraphQLSchema(authContext: AuthContext): Promise<GraphQLSchema> {
    console.time('WorkspaceSchemaFactory createGraphQLSchema');

    if (!authContext.workspace?.id) {
      return new GraphQLSchema({});
    }

    console.time('WorkspaceSchemaFactory.featureFlagChecks');
    const cachedIsNewRelationEnabled =
      await this.workspaceCacheStorageService.getIsNewRelationEnabled(
        authContext.workspace.id,
      );

    const isNewRelationEnabled = await this.featureFlagService.isFeatureEnabled(
      FeatureFlagKey.IsNewRelationEnabled,
      authContext.workspace.id,
    );

    if (isNewRelationEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow('🚧 New relation schema generation is enabled 🚧'),
      );
    }
    console.timeEnd('WorkspaceSchemaFactory featureFlagChecks');

    console.time('WorkspaceSchemaFactory getDataSourcesMetadata');
    const dataSourcesMetadata =
      await this.dataSourceService.getDataSourcesMetadataFromWorkspaceId(
        authContext.workspace.id,
      );
    console.timeEnd('WorkspaceSchemaFactory getDataSourcesMetadata');

    if (!dataSourcesMetadata || dataSourcesMetadata.length === 0) {
      return new GraphQLSchema({});
    }

    console.time('WorkspaceSchemaFactory.getMetadataVersion');
    const currentCacheVersion =
      await this.workspaceCacheStorageService.getMetadataVersion(
        authContext.workspace.id,
      );
    console.timeEnd('WorkspaceSchemaFactory.getMetadataVersion');

    if (currentCacheVersion === undefined) {
      console.time('WorkspaceSchemaFactory.recomputeMetadataCache');
      await this.workspaceMetadataCacheService.recomputeMetadataCache({
        workspaceId: authContext.workspace.id,
      });
      console.timeEnd('WorkspaceSchemaFactory.recomputeMetadataCache');

      throw new GraphqlQueryRunnerException(
        'Metadata cache version not found',
        GraphqlQueryRunnerExceptionCode.METADATA_CACHE_VERSION_NOT_FOUND,
      );
    }

    // TODO: remove this after the feature flag is droped
    if (
      (isNewRelationEnabled && cachedIsNewRelationEnabled === undefined) ||
      (isNewRelationEnabled !== cachedIsNewRelationEnabled &&
        cachedIsNewRelationEnabled !== undefined)
    ) {
      // eslint-disable-next-line no-console
      console.log(
        chalk.yellow('Recomputing due to new relation feature flag'),
        {
          isNewRelationEnabled,
        },
      );

      console.time('WorkspaceSchemaFactory.setIsNewRelationEnabled');
      await this.workspaceCacheStorageService.setIsNewRelationEnabled(
        authContext.workspace.id,
        isNewRelationEnabled,
      );
      console.timeEnd('WorkspaceSchemaFactory.setIsNewRelationEnabled');

      console.time('WorkspaceSchemaFactory.recomputeMetadataCache');
      await this.workspaceMetadataCacheService.recomputeMetadataCache({
        workspaceId: authContext.workspace.id,
      });
      console.timeEnd('WorkspaceSchemaFactory.recomputeMetadataCache');

      throw new GraphqlQueryRunnerException(
        'Metadata cache recomputation required due to relation feature flag change',
        GraphqlQueryRunnerExceptionCode.METADATA_CACHE_FEATURE_FLAG_RECOMPUTATION_REQUIRED,
      );
    }

    console.time('WorkspaceSchemaFactory.getObjectMetadataMaps');
    const objectMetadataMaps =
      await this.workspaceCacheStorageService.getObjectMetadataMaps(
        authContext.workspace.id,
        currentCacheVersion,
      );
    console.timeEnd('WorkspaceSchemaFactory.getObjectMetadataMaps');

    if (!objectMetadataMaps) {
      console.time('WorkspaceSchemaFactory.recomputeMetadataCache');
      await this.workspaceMetadataCacheService.recomputeMetadataCache({
        workspaceId: authContext.workspace.id,
      });
      console.timeEnd('WorkspaceSchemaFactory.recomputeMetadataCache');
      throw new GraphqlQueryRunnerException(
        'Object metadata collection not found',
        GraphqlQueryRunnerExceptionCode.METADATA_CACHE_VERSION_NOT_FOUND,
      );
    }

    console.time('WorkspaceSchemaFactory.buildObjectMetadataCollection');
    const objectMetadataCollection = Object.values(objectMetadataMaps.byId).map(
      (objectMetadataItem) => ({
        ...objectMetadataItem,
        fields: objectMetadataItem.fields,
        indexes: objectMetadataItem.indexMetadatas,
      }),
    );
    console.timeEnd('WorkspaceSchemaFactory.buildObjectMetadataCollection');

    // Get typeDefs from cache
    console.time('WorkspaceSchemaFactory.getGraphQLTypeDefs');
    let typeDefs = await this.workspaceCacheStorageService.getGraphQLTypeDefs(
      authContext.workspace.id,
      currentCacheVersion,
    );
    console.timeEnd('WorkspaceSchemaFactory.getGraphQLTypeDefs');

    console.time('WorkspaceSchemaFactory.getGraphQLUsedScalarNames');
    let usedScalarNames =
      await this.workspaceCacheStorageService.getGraphQLUsedScalarNames(
        authContext.workspace.id,
        currentCacheVersion,
      );
    console.timeEnd('WorkspaceSchemaFactory.getGraphQLUsedScalarNames');

    // If typeDefs are not cached, generate them
    if (!typeDefs || !usedScalarNames) {
      console.time('WorkspaceSchemaFactory.createAutoGeneratedSchema');
      const autoGeneratedSchema =
        await this.workspaceGraphQLSchemaFactory.create(
          objectMetadataCollection,
          workspaceResolverBuilderMethodNames,
        );
      console.timeEnd('WorkspaceSchemaFactory.createAutoGeneratedSchema');

      console.time('WorkspaceSchemaFactory.processScalarNames');
      usedScalarNames =
        this.scalarsExplorerService.getUsedScalarNames(autoGeneratedSchema);
      typeDefs = printSchema(autoGeneratedSchema);
      console.timeEnd('WorkspaceSchemaFactory.processScalarNames');

      console.time('WorkspaceSchemaFactory.setGraphQLTypeDefs');
      await this.workspaceCacheStorageService.setGraphQLTypeDefs(
        authContext.workspace.id,
        currentCacheVersion,
        typeDefs,
      );
      console.timeEnd('WorkspaceSchemaFactory.setGraphQLTypeDefs');

      console.time('WorkspaceSchemaFactory.setGraphQLUsedScalarNames');
      await this.workspaceCacheStorageService.setGraphQLUsedScalarNames(
        authContext.workspace.id,
        currentCacheVersion,
        usedScalarNames,
      );
      console.timeEnd('WorkspaceSchemaFactory.setGraphQLUsedScalarNames');
    }

    console.time('WorkspaceSchemaFactory.createResolvers');
    const autoGeneratedResolvers = await this.workspaceResolverFactory.create(
      authContext,
      objectMetadataMaps,
      workspaceResolverBuilderMethodNames,
    );
    console.timeEnd('WorkspaceSchemaFactory.createResolvers');

    console.timeEnd('WorkspaceSchemaFactory.createGraphQLSchema');
    
    console.time('WorkspaceSchemaFactory.getScalarResolvers');
    const scalarsResolvers =
      this.scalarsExplorerService.getScalarResolvers(usedScalarNames);
    console.timeEnd('WorkspaceSchemaFactory.getScalarResolvers');

    console.time('WorkspaceSchemaFactory.makeExecutableSchema');
    const executableSchema = makeExecutableSchema({
      typeDefs: gql`
        ${typeDefs}
      `,
      resolvers: {
        ...scalarsResolvers,
        ...autoGeneratedResolvers,
      },
    });
    console.timeEnd('WorkspaceSchemaFactory.makeExecutableSchema');

    return executableSchema;
  }
}
