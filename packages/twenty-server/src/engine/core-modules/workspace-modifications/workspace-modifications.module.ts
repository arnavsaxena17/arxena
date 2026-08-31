import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { ArxenaStandardMetadataModule } from 'src/engine/workspace-manager/arxena-standard-metadata/arxena-standard-metadata.module';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';

import { UnipileBackfillMemberMappingsCommand } from './commands/unipile-backfill-member-mappings.command';
import { WorkspaceModificationsController } from './workspace-modifications.controller';
import { WorkspaceQueryService } from './workspace-modifications.service';

@Module({
  imports: [
    ApiKeyModule,
    forwardRef(() => AuthModule),
    ArxenaStandardMetadataModule,
    TypeORMModule,
    CoreGraphQLApiModule,
    DataSourceModule,
    FeatureFlagModule,
    WorkspaceSchemaBuilderModule,
    forwardRef(() => WebSocketModule),
    WorkspaceResolverBuilderModule,
    GraphQLExecutionModule,
    GlobalWorkspaceDataSourceModule,
    TypeOrmModule.forFeature([WorkspaceEntity, UserWorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    JwtModule,
    WorkspaceDataSourceModule,
    WorkspaceCacheStorageModule,
    EnvironmentModule,
    EmailModule,
  ],
  providers: [WorkspaceQueryService, UnipileBackfillMemberMappingsCommand],
  controllers: [WorkspaceModificationsController],
  exports: [WorkspaceQueryService, UnipileBackfillMemberMappingsCommand],
})
export class WorkspaceModificationsModule {}
