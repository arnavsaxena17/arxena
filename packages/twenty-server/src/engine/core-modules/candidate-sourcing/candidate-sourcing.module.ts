// import { CandidateSourcingController } from './controllers/candidate-sourcing.controller';
// import { JobService } from './services/job.service';
import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { EnrichmentProgressController } from 'src/engine/core-modules/candidate-sourcing/controllers/enrichment-progress.controller';
import { FileUploadController } from 'src/engine/core-modules/candidate-sourcing/controllers/file-upload.controller';
import { UploadProgressController } from 'src/engine/core-modules/candidate-sourcing/controllers/upload-progress.controller';
import { CandidateQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.job';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { EnrichmentQueueProcessor } from 'src/engine/core-modules/candidate-sourcing/jobs/process-enrichments.job';
import { ProcessEnrichmentsService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-enrichments.service';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { CandidateFieldValueService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-field-value.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { ChatService } from 'src/engine/core-modules/candidate-sourcing/services/chat.service';
import { EnrichmentProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment-processor.service';
import { EnrichmentProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment-progress-pubsub.service';
import { EnrichmentService } from 'src/engine/core-modules/candidate-sourcing/services/enrichment.service';
import { FilterDescriptionProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { UploadProgressPubSubService } from 'src/engine/core-modules/candidate-sourcing/services/upload-progress-pubsub.service';
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
import { DataSourceTransformerFactoryService } from './services/data-source-transformer-factory.service';
import { ApnaDatabaseTransformerService } from './services/data-sources/apna-database-transformer.service';
import { HiringNaukriTransformerService } from './services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from './services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from './services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from './services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { NaukriProfileDataTransformerService } from './services/data-sources/naukri-profile-data-transformer.service';
import { ResdexNaukriTransformerService } from './services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from './services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from './services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from './services/data-sources/uploaded-profiles-transformer.service';
import { DataProcessingUtils } from './utils/data-processing.utils';

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
    // MulterModule.register({
    //   dest: './uploads',
    // }),
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    DataSourceModule,
    JwtModule,
  ],
  controllers: [CandidateSourcingController, EnrichmentProgressController, FileUploadController, UploadProgressController],
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
    EnrichmentProgressPubSubService,
    UploadProgressPubSubService,
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
    // Data transformation services
    DataProcessingUtils,
    DataSourceTransformerFactoryService,
    ResdexNaukriTransformerService,
    HiringNaukriTransformerService,
    LinkedinPremiumTransformerService,
    SpreadsheetImportTwentyTransformerService,
    RmsNaukriTransformerService,
    ApnaDatabaseTransformerService,
    NaukriProfileDataTransformerService,
    UploadedProfilesTransformerService,
    LinkedinRecruiterJobsTransformerService,
    LinkedinPremiumJobsTransformerService,
  ],
  exports: [
    PersonService,
    CandidateService,
    ChatService,
    ProcessCandidatesService,
    ProcessEnrichmentsService,
    DataSourceTransformerFactoryService,
    DataProcessingUtils,
  ],
})
export class CandidateSourcingModule {}
