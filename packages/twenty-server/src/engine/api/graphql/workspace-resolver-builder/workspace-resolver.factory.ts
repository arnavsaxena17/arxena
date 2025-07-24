import { Injectable, Logger } from '@nestjs/common';

import { IResolvers } from '@graphql-tools/utils';

import { DeleteManyResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/delete-many-resolver.factory';
import { DestroyManyResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/destroy-many-resolver.factory';
import { DestroyOneResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/destroy-one-resolver.factory';
import { RestoreManyResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/restore-many-resolver.factory';
import { RestoreOneResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/restore-one-resolver.factory';
import { SearchResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/search-resolver-factory';
import { UpdateManyResolverFactory } from 'src/engine/api/graphql/workspace-resolver-builder/factories/update-many-resolver.factory';
import { WorkspaceResolverBuilderService } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.service';
import { AuthContext } from 'src/engine/core-modules/auth/types/auth-context.type';
import { ObjectMetadataMaps } from 'src/engine/metadata-modules/types/object-metadata-maps';
import { getResolverName } from 'src/engine/utils/get-resolver-name.util';

import { CreateManyResolverFactory } from './factories/create-many-resolver.factory';
import { CreateOneResolverFactory } from './factories/create-one-resolver.factory';
import { DeleteOneResolverFactory } from './factories/delete-one-resolver.factory';
import { FindDuplicatesResolverFactory } from './factories/find-duplicates-resolver.factory';
import { FindManyResolverFactory } from './factories/find-many-resolver.factory';
import { FindOneResolverFactory } from './factories/find-one-resolver.factory';
import { UpdateOneResolverFactory } from './factories/update-one-resolver.factory';
import { WorkspaceResolverBuilderFactoryInterface } from './interfaces/workspace-resolver-builder-factory.interface';
import {
  WorkspaceResolverBuilderMethodNames,
  WorkspaceResolverBuilderMethods,
} from './interfaces/workspace-resolvers-builder.interface';

@Injectable()
export class WorkspaceResolverFactory {
  private readonly logger = new Logger(WorkspaceResolverFactory.name);

  constructor(
    private readonly findManyResolverFactory: FindManyResolverFactory,
    private readonly findOneResolverFactory: FindOneResolverFactory,
    private readonly findDuplicatesResolverFactory: FindDuplicatesResolverFactory,
    private readonly createManyResolverFactory: CreateManyResolverFactory,
    private readonly createOneResolverFactory: CreateOneResolverFactory,
    private readonly updateOneResolverFactory: UpdateOneResolverFactory,
    private readonly deleteOneResolverFactory: DeleteOneResolverFactory,
    private readonly destroyOneResolverFactory: DestroyOneResolverFactory,
    private readonly updateManyResolverFactory: UpdateManyResolverFactory,
    private readonly deleteManyResolverFactory: DeleteManyResolverFactory,
    private readonly restoreOneResolverFactory: RestoreOneResolverFactory,
    private readonly restoreManyResolverFactory: RestoreManyResolverFactory,
    private readonly destroyManyResolverFactory: DestroyManyResolverFactory,
    private readonly searchResolverFactory: SearchResolverFactory,
    private readonly workspaceResolverBuilderService: WorkspaceResolverBuilderService,
  ) {}

  async create(
    authContext: AuthContext,
    objectMetadataMaps: ObjectMetadataMaps,
    workspaceResolverBuilderMethods: WorkspaceResolverBuilderMethods,
  ): Promise<IResolvers> {
    const startTime = performance.now();
    // console.log('WorkspaceResolverFactory.create started');
    
    const factoriesSetupStartTime = performance.now();
    const factories = new Map<
      WorkspaceResolverBuilderMethodNames,
      WorkspaceResolverBuilderFactoryInterface
    >([
      ['createMany', this.createManyResolverFactory],
      ['createOne', this.createOneResolverFactory],
      ['deleteMany', this.deleteManyResolverFactory],
      ['deleteOne', this.deleteOneResolverFactory],
      ['destroyMany', this.destroyManyResolverFactory],
      ['destroyOne', this.destroyOneResolverFactory],
      ['findDuplicates', this.findDuplicatesResolverFactory],
      ['findMany', this.findManyResolverFactory],
      ['findOne', this.findOneResolverFactory],
      ['restoreMany', this.restoreManyResolverFactory],
      ['restoreOne', this.restoreOneResolverFactory],
      ['search', this.searchResolverFactory],
      ['updateMany', this.updateManyResolverFactory],
      ['updateOne', this.updateOneResolverFactory],
    ]);
    const factoriesSetupEndTime = performance.now();
    // console.log(`Factories Setup: ${(factoriesSetupEndTime - factoriesSetupStartTime).toFixed(2)}ms`);
    
    const resolversSetupStartTime = performance.now();
    const resolvers: IResolvers = {
      Query: {},
      Mutation: {},
    };
    const resolversSetupEndTime = performance.now();
    // console.log(`Resolvers Setup: ${(resolversSetupEndTime - resolversSetupStartTime).toFixed(2)}ms`);

    const objectMetadataCount = Object.values(objectMetadataMaps.byId).length;
    // console.log(`Processing ${objectMetadataCount} object metadata items`);

    const objectProcessingStartTime = performance.now();
    for (const objectMetadata of Object.values(objectMetadataMaps.byId)) {
      const objectStartTime = performance.now();
      // console.log(`Processing object: ${objectMetadata.nameSingular}`);
      
      // Generate query resolvers
      const queryResolversStartTime = performance.now();
      for (const methodName of workspaceResolverBuilderMethods.queries) {
        const methodStartTime = performance.now();
        const resolverName = getResolverName(objectMetadata, methodName);
        const resolverFactory = factories.get(methodName);

        if (!resolverFactory) {
          this.logger.error(`Unknown query resolver type: ${methodName}`, {
            objectMetadata,
            methodName,
            resolverName,
          });

          throw new Error(`Unknown query resolver type: ${methodName}`);
        }

        if (
          this.workspaceResolverBuilderService.shouldBuildResolver(
            objectMetadata,
            methodName,
          )
        ) {
          // console.log(`Creating query resolver: ${resolverName}`);
          const resolverCreationStartTime = performance.now();
          resolvers.Query[resolverName] = resolverFactory.create({
            authContext,
            objectMetadataMaps,
            objectMetadataItemWithFieldMaps: objectMetadata,
          });
          const resolverCreationEndTime = performance.now();
          // console.log(`Query resolver ${resolverName} created in: ${(resolverCreationEndTime - resolverCreationStartTime).toFixed(2)}ms`);
        } else {
          // console.log(`Skipping query resolver: ${resolverName} (shouldBuildResolver returned false)`);
        }
        
        const methodEndTime = performance.now();
        // console.log(`Method ${methodName} processed in: ${(methodEndTime - methodStartTime).toFixed(2)}ms`);
      }
      const queryResolversEndTime = performance.now();
      // console.log(`Query resolvers for ${objectMetadata.nameSingular}: ${(queryResolversEndTime - queryResolversStartTime).toFixed(2)}ms`);

      // Generate mutation resolvers
      const mutationResolversStartTime = performance.now();
      for (const methodName of workspaceResolverBuilderMethods.mutations) {
        const methodStartTime = performance.now();
        const resolverName = getResolverName(objectMetadata, methodName);
        const resolverFactory = factories.get(methodName);

        if (!resolverFactory) {
          this.logger.error(`Unknown mutation resolver type: ${methodName}`, {
            objectMetadata,
            methodName,
            resolverName,
          });

          throw new Error(`Unknown mutation resolver type: ${methodName}`);
        }

        const resolverCreationStartTime = performance.now();
        resolvers.Mutation[resolverName] = resolverFactory.create({
          authContext,
          objectMetadataMaps,
          objectMetadataItemWithFieldMaps: objectMetadata,
        });
        const resolverCreationEndTime = performance.now();
        // console.log(`Mutation resolver ${resolverName} created in: ${(resolverCreationEndTime - resolverCreationStartTime).toFixed(2)}ms`);
        
        const methodEndTime = performance.now();
        // console.log(`Method ${methodName} processed in: ${(methodEndTime - methodStartTime).toFixed(2)}ms`);
      }
      const mutationResolversEndTime = performance.now();
      // console.log(`Mutation resolvers for ${objectMetadata.nameSingular}: ${(mutationResolversEndTime - mutationResolversStartTime).toFixed(2)}ms`);
      
      const objectEndTime = performance.now();
      // console.log(`Object ${objectMetadata.nameSingular} processed in: ${(objectEndTime - objectStartTime).toFixed(2)}ms`);
      // console.log('---');
    }
    const objectProcessingEndTime = performance.now();
    // console.log(`All objects processed in: ${(objectProcessingEndTime - objectProcessingStartTime).toFixed(2)}ms`);

    const totalEndTime = performance.now();
    // console.log(`Total WorkspaceResolverFactory.create execution: ${(totalEndTime - startTime).toFixed(2)}ms`);
    //  console.log('===');

    return resolvers;
  }
}
