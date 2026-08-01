import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { CoreEntityCacheModule } from 'src/engine/core-entity-cache/core-entity-cache.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { GraphQLExecutionService } from './graphql-execution.service';
import { SchemaCacheService } from './services/schema-cache.service';
import { StaticGraphQLService } from './static-graphql.service';

@Module({
  imports: [
    JwtModule,
    CoreGraphQLApiModule,
    WorkspaceCacheStorageModule,
    CoreEntityCacheModule,
    TypeOrmModule.forFeature([
      UserEntity,
      WorkspaceEntity,
      UserWorkspaceEntity,
    ]),
  ],
  providers: [
    GraphQLExecutionService,
    StaticGraphQLService,
    SchemaCacheService,
  ],
  exports: [GraphQLExecutionService, StaticGraphQLService],
})
export class GraphQLExecutionModule {}
