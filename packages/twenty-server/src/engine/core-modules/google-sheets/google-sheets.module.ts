import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { MetadataUpdateService } from 'src/engine/core-modules/workspace-modifications/object-apis/services/metadata-update.service';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataModule } from 'src/engine/metadata-modules/field-metadata/field-metadata.module';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/field-metadata.service';
import { IndexFieldMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-field-metadata.entity';
import { IndexMetadataEntity } from 'src/engine/metadata-modules/index-metadata/index-metadata.entity';
import { IndexMetadataModule } from 'src/engine/metadata-modules/index-metadata/index-metadata.module';
import { IndexMetadataService } from 'src/engine/metadata-modules/index-metadata/index-metadata.service';
import { MetadataEngineModule } from 'src/engine/metadata-modules/metadata-engine.module';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { ObjectMetadataService } from 'src/engine/metadata-modules/object-metadata/object-metadata.service';
import { ObjectMetadataMigrationService } from 'src/engine/metadata-modules/object-metadata/services/object-metadata-migration.service';
import { ObjectMetadataRelatedRecordsService } from 'src/engine/metadata-modules/object-metadata/services/object-metadata-related-records.service';
import { ObjectMetadataRelationService } from 'src/engine/metadata-modules/object-metadata/services/object-metadata-relation.service';
import { RelationMetadataEntity } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.entity';
import { RelationMetadataModule } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.module';
import { RelationMetadataService } from 'src/engine/metadata-modules/relation-metadata/relation-metadata.service';
import { RemoteTableRelationsModule } from 'src/engine/metadata-modules/remote-server/remote-table/remote-table-relations/remote-table-relations.module';
import { SearchModule } from 'src/engine/metadata-modules/search/search.module';
import { WorkspaceMetadataVersionModule } from 'src/engine/metadata-modules/workspace-metadata-version/workspace-metadata-version.module';
import { WorkspaceMigrationModule } from 'src/engine/metadata-modules/workspace-migration/workspace-migration.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WorkspaceMigrationRunnerModule } from 'src/engine/workspace-manager/workspace-migration-runner/workspace-migration-runner.module';
import { ViewModule } from 'src/modules/view/view.module';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { AppToken } from '../app-token/app-token.entity';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { ProcessCandidatesService } from '../candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from '../candidate-sourcing/services/candidate.service';
import { ChatService } from '../candidate-sourcing/services/chat.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { User } from '../user/user.entity';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { Workspace } from '../workspace/workspace.entity';
import { GoogleSheetsDataController } from './google-sheet-data.controller';
import { GoogleSheetsController } from './google-sheets.controller';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [
    JwtModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    TypeOrmModule.forFeature(
      [
        DataSourceEntity,
        ObjectMetadataEntity,
        FieldMetadataEntity,
        RelationMetadataEntity,
        IndexMetadataEntity,
        IndexFieldMetadataEntity,
      ],
      'metadata',
    ),
    DataSourceModule,
    ObjectMetadataModule,
    FieldMetadataModule,
    RelationMetadataModule,
    MetadataEngineModule,
    RemoteTableRelationsModule,
    WorkspaceMigrationRunnerModule,
    WorkspaceMetadataVersionModule,
    SearchModule,
    WorkspaceMigrationModule,
    ViewModule,
    WorkspaceCacheStorageModule,
    IndexMetadataModule,
    WorkspaceModificationsModule,
  ],
  providers: [
    PersonService,
    GoogleSheetsService,
    WebSocketGateway,
    ProcessCandidatesService,
    JwtWrapperService,
    CandidateService,
    ChatService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    EnvironmentService,
    ApiKeyService,
    JwtAuthStrategy,
    EmailService,
    WebSocketService,
    AccessTokenService,
    DataSourceService,
    ObjectMetadataService,
    FieldMetadataService,
    RelationMetadataService,
    ObjectMetadataRelationService,
    ObjectMetadataMigrationService,
    ObjectMetadataRelatedRecordsService,
    IndexMetadataService,
    MetadataUpdateService,
  ],
  controllers: [GoogleSheetsController, GoogleSheetsDataController],
  exports: [PersonService, CandidateService, ChatService, ProcessCandidatesService],
})
export class GoogleSheetsModule {}
