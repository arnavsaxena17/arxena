import { Module } from '@nestjs/common';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { JwtModule } from '../jwt/jwt.module';
import { GraphQLExecutionService } from './graphql-execution.service';
import { QueryCacheService } from './services/query-cache.service';
import { SchemaCacheService } from './services/schema-cache.service';
import { StaticGraphQLService } from './static-graphql.service';

@Module({
  imports: [
    JwtModule,
    WorkspaceSchemaBuilderModule,
    CoreGraphQLApiModule,
  ],
  providers: [
    GraphQLExecutionService, 
    StaticGraphQLService,
    SchemaCacheService,
    QueryCacheService,
    WorkspaceCacheStorageService,
  ],
  exports: [GraphQLExecutionService, StaticGraphQLService],
})
export class GraphQLExecutionModule {} 