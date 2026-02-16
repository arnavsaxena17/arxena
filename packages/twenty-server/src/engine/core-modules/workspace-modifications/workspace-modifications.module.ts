import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';

import { JwtService } from '@nestjs/jwt/dist/jwt.service';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { GraphQLExecutionService } from 'src/engine/core-modules/graphql/graphql-execution.service';
import { SchemaCacheService } from 'src/engine/core-modules/graphql/services/schema-cache.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { WorkspaceMetadataCacheModule } from 'src/engine/metadata-modules/workspace-metadata-cache/workspace-metadata-cache.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { EmailModule } from '../email/email.module';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { CreateMetadataStructureJob } from './jobs/create-metadata-structure.job';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';
import { WorkspaceModificationsController } from './workspace-modifications.controller';
import { WorkspaceQueryService } from './workspace-modifications.service';

@Module({
  imports: [
    AuthModule,
    MessageQueueModule,
    TypeORMModule,
    CoreGraphQLApiModule,
    DataSourceModule,
    WorkspaceMetadataCacheModule,
    FeatureFlagModule,
    TypeORMModule,
    WorkspaceSchemaBuilderModule, 
    WebSocketModule,
    WorkspaceResolverBuilderModule,
    GraphQLExecutionModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    JwtModule,
    WorkspaceDataSourceModule,
    EmailModule,
  ],
  providers: [
    CreateMetadataStructureJob,
    WorkspaceCacheStorageService,
    EnvironmentService,
    GraphQLExecutionService,
    WorkspaceQueryService,
    StaticGraphQLService,
    JwtService, 
    SchemaCacheService,
    WorkspaceDataSourceService,
    ApiKeyService,
    MetadataUpdateService,
    WorkspaceSchemaFactory,
    JwtWrapperService,
  ],
  controllers: [WorkspaceModificationsController],

  exports: [WorkspaceQueryService],
})
export class WorkspaceModificationsModule {}
