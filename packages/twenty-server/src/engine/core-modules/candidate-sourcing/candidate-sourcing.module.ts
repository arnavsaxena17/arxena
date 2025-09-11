// import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
// import { JobService } from './services/job.service';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { JwtAuthStrategy } from 'src/engine/core-modules/auth/strategies/jwt.auth.strategy';
import { CandidateSourcingController } from 'src/engine/core-modules/candidate-sourcing/controllers/candidate-sourcing.controller';
import { FileUploadController } from 'src/engine/core-modules/candidate-sourcing/controllers/file-upload.controller';
import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { EnrichmentQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-enrichments.job';
import { ProcessEnrichmentsService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-enrichments.service';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { CandidateFieldValueService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-field-value.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { ChatService } from 'src/engine/core-modules/candidate-sourcing/services/chat.service';
import { EnrichmentProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment-processor.service';
import { EnrichmentService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment.service';
import { FilterDescriptionProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { CandidateEngagementProcessor } from '../cron-processes/services/candidate-engagement-processor.job';

@Module({
  imports: [
    AuthModule,
    WebSocketModule,
    WorkspaceModificationsModule,
    TypeORMModule,
    AuthModule, 
    GraphQLExecutionModule,
    WorkspaceModificationsModule, 
    CoreGraphQLApiModule,
    MulterModule.register({
      dest: './uploads',
    }),
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    DataSourceModule,
    JwtModule,
  ],
  controllers: [CandidateSourcingController, FileUploadController],
  providers: [
    // JobService,
    ExtSockWhatsappWhitelistProcessingService,
    PersonService,
    GoogleSheetsService,
    ExtSockWhatsappMessageProcessor,
    RedisService,
    ProcessCandidatesService,
    ProcessEnrichmentsService,
    CandidateService,
    ApiKeyService,
    ChatService,
    FilterDescriptionProcessorService,
    EnrichmentService,
    EnrichmentProcessorService,
    CandidateDataService,
    CandidateFieldValueService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    EnvironmentService,
    WorkspaceCacheStorageService,
    CandidateQueueProcessor,
    EnrichmentQueueProcessor,
    CandidateEngagementProcessor,
    JwtService,
    JwtAuthStrategy,
    EmailService,
  ],
  exports: [
    PersonService,
    CandidateService,
    ChatService,
    ProcessCandidatesService,
    ProcessEnrichmentsService,
  ],
})
export class CandidateSourcingModule {}
