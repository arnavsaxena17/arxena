import { Inject, Injectable } from '@nestjs/common';

import graphqlFields from 'graphql-fields';
import {
  capitalize,
  isObjectRecordUnderObjectRecordsPermissions,
  PermissionsOnAllObjectRecords,
  SettingsFeatures,
} from 'twenty-shared';
import { DataSource, ObjectLiteral } from 'typeorm';

import { ObjectRecord } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { IConnection } from 'src/engine/api/graphql/workspace-query-runner/interfaces/connection.interface';
import { IEdge } from 'src/engine/api/graphql/workspace-query-runner/interfaces/edge.interface';
import { WorkspaceQueryRunnerOptions } from 'src/engine/api/graphql/workspace-query-runner/interfaces/query-runner-option.interface';
import {
  ResolverArgs,
  ResolverArgsType,
  WorkspaceResolverBuilderMethodNames,
} from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { SYSTEM_OBJECTS_PERMISSIONS_REQUIREMENTS } from 'src/engine/api/graphql/graphql-query-runner/constants/system-objects-permissions-requirements.constant';
import { GraphqlQuerySelectedFieldsResult } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields.parser';
import { GraphqlQueryParser } from 'src/engine/api/graphql/graphql-query-runner/graphql-query-parsers/graphql-query.parser';
import { ProcessNestedRelationsHelper } from 'src/engine/api/graphql/graphql-query-runner/helpers/process-nested-relations.helper';
import { ApiEventEmitterService } from 'src/engine/api/graphql/graphql-query-runner/services/api-event-emitter.service';
import { QueryResultGettersFactory } from 'src/engine/api/graphql/workspace-query-runner/factories/query-result-getters/query-result-getters.factory';
import { QueryRunnerArgsFactory } from 'src/engine/api/graphql/workspace-query-runner/factories/query-runner-args.factory';
import { workspaceQueryRunnerGraphqlApiExceptionHandler } from 'src/engine/api/graphql/workspace-query-runner/utils/workspace-query-runner-graphql-api-exception-handler.util';
import { WorkspaceQueryHookService } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/workspace-query-hook.service';
import { RESOLVER_METHOD_NAMES } from 'src/engine/api/graphql/workspace-resolver-builder/constants/resolver-method-names';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';

export type GraphqlQueryResolverExecutionArgs<Input extends ResolverArgs> = {
  args: Input;
  options: WorkspaceQueryRunnerOptions;
  dataSource: DataSource;
  repository: WorkspaceRepository<ObjectLiteral>;
  graphqlQueryParser: GraphqlQueryParser;
  graphqlQuerySelectedFieldsResult: GraphqlQuerySelectedFieldsResult;
};

@Injectable()
export abstract class GraphqlQueryBaseResolverService<
  Input extends ResolverArgs,
  Response extends
    | ObjectRecord
    | ObjectRecord[]
    | IConnection<ObjectRecord, IEdge<ObjectRecord>>
    | IConnection<ObjectRecord, IEdge<ObjectRecord>>[],
> {
  @Inject()
  protected readonly workspaceQueryHookService: WorkspaceQueryHookService;
  @Inject()
  protected readonly queryRunnerArgsFactory: QueryRunnerArgsFactory;
  @Inject()
  protected readonly queryResultGettersFactory: QueryResultGettersFactory;
  @Inject()
  protected readonly apiEventEmitterService: ApiEventEmitterService;
  @Inject()
  protected readonly twentyORMGlobalManager: TwentyORMGlobalManager;
  @Inject()
  protected readonly processNestedRelationsHelper: ProcessNestedRelationsHelper;
  @Inject()
  protected readonly featureFlagService: FeatureFlagService;
  @Inject()
  protected readonly permissionsService: PermissionsService;

  public async execute(
    args: Input,
    options: WorkspaceQueryRunnerOptions,
    operationName: WorkspaceResolverBuilderMethodNames,
  ): Promise<Response | undefined> {
    const startTime = performance.now();
    
    try {
      const { authContext, objectMetadataItemWithFieldMaps } = options;
      console.log("Executing resolver", operationName);
      
      const validationStartTime = performance.now();
      await this.validate(args, options);
      const validationEndTime = performance.now();
      console.log(`Validation: ${(validationEndTime - validationStartTime).toFixed(2)}ms`);

      const featureFlagsStartTime = performance.now();
      const featureFlagsMap =
        await this.featureFlagService.getWorkspaceFeatureFlagsMap(
          authContext.workspace.id,
        );
      const featureFlagsEndTime = performance.now();
      console.log(`Feature Flags: ${(featureFlagsEndTime - featureFlagsStartTime).toFixed(2)}ms`);

      const systemPermissionsStartTime = performance.now();
      if (
        featureFlagsMap[FeatureFlagKey.IsPermissionsEnabled] &&
        objectMetadataItemWithFieldMaps.isSystem === true
      ) {
        await this.validateSystemObjectPermissionsOrThrow(options);
      }
      const systemPermissionsEndTime = performance.now();
      console.log(`System Permissions: ${(systemPermissionsEndTime - systemPermissionsStartTime).toFixed(2)}ms`);

      const customPermissionsStartTime = performance.now();
      if (
        featureFlagsMap[FeatureFlagKey.IsPermissionsEnabled] &&
        isObjectRecordUnderObjectRecordsPermissions({
          isCustom: objectMetadataItemWithFieldMaps.isCustom,
          nameSingular: objectMetadataItemWithFieldMaps.nameSingular,
        })
      ) {
        await this.validateCustomObjectPermissionsOrThrow({
          operationName,
          options,
        });
      }
      const customPermissionsEndTime = performance.now();
      console.log(`Custom Permissions: ${(customPermissionsEndTime - customPermissionsStartTime).toFixed(2)}ms`);

      const preQueryHooksStartTime = performance.now();
      const hookedArgs =
        await this.workspaceQueryHookService.executePreQueryHooks(
          authContext,
          objectMetadataItemWithFieldMaps.nameSingular,
          operationName,
          args,
        );
      const preQueryHooksEndTime = performance.now();
      console.log(`Pre-Query Hooks: ${(preQueryHooksEndTime - preQueryHooksStartTime).toFixed(2)}ms`);

      const argsFactoryStartTime = performance.now();
      const computedArgs = (await this.queryRunnerArgsFactory.create(
        hookedArgs,
        options,
        ResolverArgsType[capitalize(operationName)],
      )) as Input;
      const argsFactoryEndTime = performance.now();
      console.log(`Args Factory: ${(argsFactoryEndTime - argsFactoryStartTime).toFixed(2)}ms`);

      const dataSourceStartTime = performance.now();
      const dataSource =
        await this.twentyORMGlobalManager.getDataSourceForWorkspace(
          authContext.workspace.id,
        );
      const dataSourceEndTime = performance.now();
      console.log(`DataSource Setup: ${(dataSourceEndTime - dataSourceStartTime).toFixed(2)}ms`);

      const repositoryStartTime = performance.now();
      const repository = dataSource.getRepository(
        objectMetadataItemWithFieldMaps.nameSingular,
      );
      const repositoryEndTime = performance.now();
      console.log(`Repository Setup: ${(repositoryEndTime - repositoryStartTime).toFixed(2)}ms`);

      const parserStartTime = performance.now();
      const graphqlQueryParser = new GraphqlQueryParser(
        objectMetadataItemWithFieldMaps.fieldsByName,
        options.objectMetadataMaps,
        featureFlagsMap,
      );
      const parserEndTime = performance.now();
      console.log(`Query Parser Setup: ${(parserEndTime - parserStartTime).toFixed(2)}ms`);

      const selectedFieldsStartTime = performance.now();
      const selectedFields = graphqlFields(options.info);
      const selectedFieldsEndTime = performance.now();
      console.log(`Selected Fields: ${(selectedFieldsEndTime - selectedFieldsStartTime).toFixed(2)}ms`);

      const parseSelectedFieldsStartTime = performance.now();
      const graphqlQuerySelectedFieldsResult =
        graphqlQueryParser.parseSelectedFields(
          objectMetadataItemWithFieldMaps,
          selectedFields,
        );
      const parseSelectedFieldsEndTime = performance.now();
      console.log(`Parse Selected Fields: ${(parseSelectedFieldsEndTime - parseSelectedFieldsStartTime).toFixed(2)}ms`);

      const graphqlQueryResolverExecutionArgs = {
        args: computedArgs,
        options,
        dataSource,
        repository,
        graphqlQueryParser,
        graphqlQuerySelectedFieldsResult,
      };

      const resolveStartTime = performance.now();
      const results = await this.resolve(
        graphqlQueryResolverExecutionArgs,
        featureFlagsMap,
      );
      const resolveEndTime = performance.now();
      console.log(`Resolve Operation: ${(resolveEndTime - resolveStartTime).toFixed(2)}ms`);

      const resultGettersStartTime = performance.now();
      const resultWithGetters = await this.queryResultGettersFactory.create(
        results,
        objectMetadataItemWithFieldMaps,
        authContext.workspace.id,
        options.objectMetadataMaps,
        featureFlagsMap[FeatureFlagKey.IsNewRelationEnabled],
      );
      const resultGettersEndTime = performance.now();
      console.log(`Result Getters: ${(resultGettersEndTime - resultGettersStartTime).toFixed(2)}ms`);

      const resultWithGettersArray = Array.isArray(resultWithGetters)
        ? resultWithGetters
        : [resultWithGetters];

      const postQueryHooksStartTime = performance.now();
      await this.workspaceQueryHookService.executePostQueryHooks(
        authContext,
        objectMetadataItemWithFieldMaps.nameSingular,
        operationName,
        resultWithGettersArray,
      );
      const postQueryHooksEndTime = performance.now();
      console.log(`Post-Query Hooks: ${(postQueryHooksEndTime - postQueryHooksStartTime).toFixed(2)}ms`);

      const totalEndTime = performance.now();
      console.log(`Total Base Resolver Execution: ${(totalEndTime - startTime).toFixed(2)}ms`);
      console.log('---');

      return resultWithGetters;
    } catch (error) {
      workspaceQueryRunnerGraphqlApiExceptionHandler(error, options);
    }
  }

  private async validateSystemObjectPermissionsOrThrow(
    options: WorkspaceQueryRunnerOptions,
  ) {
    const { authContext, objectMetadataItemWithFieldMaps } = options;

    if (
      Object.keys(SYSTEM_OBJECTS_PERMISSIONS_REQUIREMENTS).includes(
        objectMetadataItemWithFieldMaps.nameSingular,
      )
    ) {
      if (!authContext.apiKey) {
        if (!authContext.userWorkspaceId) {
          throw new AuthException(
            'Missing userWorkspaceId in authContext',
            AuthExceptionCode.USER_WORKSPACE_NOT_FOUND,
          );
        }

        const permissionRequired: SettingsFeatures =
          SYSTEM_OBJECTS_PERMISSIONS_REQUIREMENTS[
            objectMetadataItemWithFieldMaps.nameSingular
          ];

        const userHasPermission =
          await this.permissionsService.userHasWorkspaceSettingPermission({
            userWorkspaceId: authContext.userWorkspaceId,
            _setting: permissionRequired,
            workspaceId: authContext.workspace.id,
          });

        if (!userHasPermission) {
          throw new PermissionsException(
            PermissionsExceptionMessage.PERMISSION_DENIED,
            PermissionsExceptionCode.PERMISSION_DENIED,
          );
        }
      }
    }
  }

  private async validateCustomObjectPermissionsOrThrow({
    operationName,
    options,
  }: {
    operationName: WorkspaceResolverBuilderMethodNames;
    options: WorkspaceQueryRunnerOptions;
  }) {
    if (!options.authContext.apiKey) {
      if (!options.authContext.userWorkspaceId) {
        throw new AuthException(
          'Missing userWorkspaceId in authContext',
          AuthExceptionCode.USER_WORKSPACE_NOT_FOUND,
        );
      }

      const requiredPermission =
        this.getRequiredPermissionForMethod(operationName);

      const userHasPermission =
        await this.permissionsService.userHasObjectRecordsPermission({
          userWorkspaceId: options.authContext.userWorkspaceId,
          requiredPermission,
          workspaceId: options.authContext.workspace.id,
        });

      if (!userHasPermission) {
        throw new PermissionsException(
          PermissionsExceptionMessage.PERMISSION_DENIED,
          PermissionsExceptionCode.PERMISSION_DENIED,
        );
      }
    }
  }

  private getRequiredPermissionForMethod(
    operationName: WorkspaceResolverBuilderMethodNames,
  ) {
    switch (operationName) {
      case RESOLVER_METHOD_NAMES.FIND_MANY:
      case RESOLVER_METHOD_NAMES.FIND_ONE:
      case RESOLVER_METHOD_NAMES.FIND_DUPLICATES:
      case RESOLVER_METHOD_NAMES.SEARCH:
        return PermissionsOnAllObjectRecords.READ_ALL_OBJECT_RECORDS;
      case RESOLVER_METHOD_NAMES.CREATE_MANY:
      case RESOLVER_METHOD_NAMES.CREATE_ONE:
      case RESOLVER_METHOD_NAMES.UPDATE_MANY:
      case RESOLVER_METHOD_NAMES.UPDATE_ONE:
        return PermissionsOnAllObjectRecords.UPDATE_ALL_OBJECT_RECORDS;
      case RESOLVER_METHOD_NAMES.DELETE_MANY:
      case RESOLVER_METHOD_NAMES.DELETE_ONE:
      case RESOLVER_METHOD_NAMES.RESTORE_MANY:
      case RESOLVER_METHOD_NAMES.RESTORE_ONE:
        return PermissionsOnAllObjectRecords.SOFT_DELETE_ALL_OBJECT_RECORDS;
      case RESOLVER_METHOD_NAMES.DESTROY_MANY:
      case RESOLVER_METHOD_NAMES.DESTROY_ONE:
        return PermissionsOnAllObjectRecords.DESTROY_ALL_OBJECT_RECORDS;
      default:
        throw new PermissionsException(
          PermissionsExceptionMessage.UNKNOWN_OPERATION_NAME,
          PermissionsExceptionCode.UNKNOWN_OPERATION_NAME,
        );
    }
  }

  protected abstract resolve(
    executionArgs: GraphqlQueryResolverExecutionArgs<Input>,
    featureFlagsMap: Record<FeatureFlagKey, boolean>,
  ): Promise<Response>;

  protected abstract validate(
    args: Input,
    options: WorkspaceQueryRunnerOptions,
  ): Promise<void>;
}
