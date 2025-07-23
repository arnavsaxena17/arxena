import { Injectable } from '@nestjs/common';

import { WorkspaceQueryRunnerOptions } from 'src/engine/api/graphql/workspace-query-runner/interfaces/query-runner-option.interface';
import { WorkspaceResolverBuilderFactoryInterface } from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolver-builder-factory.interface';
import {
  FindManyResolverArgs,
  Resolver,
} from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';
import { WorkspaceSchemaBuilderContext } from 'src/engine/api/graphql/workspace-schema-builder/interfaces/workspace-schema-builder-context.interface';

import { GraphqlQueryFindManyResolverService } from 'src/engine/api/graphql/graphql-query-runner/resolvers/graphql-query-find-many-resolver.service';
import { RESOLVER_METHOD_NAMES } from 'src/engine/api/graphql/workspace-resolver-builder/constants/resolver-method-names';

@Injectable()
export class FindManyResolverFactory
  implements WorkspaceResolverBuilderFactoryInterface
{
  public static methodName = RESOLVER_METHOD_NAMES.FIND_MANY;

  constructor(
    private readonly graphqlQueryRunnerService: GraphqlQueryFindManyResolverService,
  ) {}

  create(
    context: WorkspaceSchemaBuilderContext,
  ): Resolver<FindManyResolverArgs> {
    const internalContext = context;
    const objectName = internalContext.objectMetadataItemWithFieldMaps.nameSingular;
    const uniqueLabel = `FindManyResolverFactory.create.${objectName}`;

    console.time(uniqueLabel);
    console.log('Creating FindMany resolver for:', objectName);

    return async (_source, args, _context, info) => {
      const resolverStartTime = performance.now();
      console.log('FindMany resolver execution started');
      
      const optionsStartTime = performance.now();
      const options: WorkspaceQueryRunnerOptions = {
        authContext: internalContext.authContext,
        info,
        objectMetadataMaps: internalContext.objectMetadataMaps,
        objectMetadataItemWithFieldMaps:
          internalContext.objectMetadataItemWithFieldMaps,
      };
      const optionsEndTime = performance.now();
      console.log(`Options Setup: ${(optionsEndTime - optionsStartTime).toFixed(2)}ms`);

      const executeStartTime = performance.now();
      const response = await this.graphqlQueryRunnerService.execute(
        args,
        options,
        FindManyResolverFactory.methodName,
      );
      const executeEndTime = performance.now();
      console.log(`GraphQL Query Runner Execute: ${(executeEndTime - executeStartTime).toFixed(2)}ms`);

      const totalEndTime = performance.now();
      console.log(`Total FindMany Resolver Execution: ${(totalEndTime - resolverStartTime).toFixed(2)}ms`);
      console.log('---');
      
      try {
        console.timeEnd(uniqueLabel);
      } catch (error) {
        // Ignore console.timeEnd errors
      }

      return response;
    };
  }
}
