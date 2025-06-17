import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { MetadataEngineModule } from 'src/engine/metadata-modules/metadata-engine.module';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { RelationMetadataModule } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';

import { CreateMetaDataStructure } from './object-apis/object-apis-creation';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';
import { WorkspaceModificationsController } from './workspace-modifications.controller';
import { WorkspaceQueryService } from './workspace-modifications.service';

@Module({
  imports: [
    AuthModule,
    DataSourceModule,
    TypeORMModule,
    WebSocketModule,
    EmailModule,
    MetadataEngineModule,
    ObjectMetadataModule,
    FieldMetadataModule,
    RelationMetadataModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    JwtModule,
  ],
  providers: [
    WorkspaceCacheStorageService,
    EnvironmentService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    ApiKeyService,
    MetadataUpdateService,
    CreateMetaDataStructure,
  ],
  controllers: [WorkspaceModificationsController],
  exports: [WorkspaceQueryService, MetadataUpdateService],
})
export class WorkspaceModificationsModule {}
