import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { TwilioControllers } from 'src/engine/core-modules/arx-chat/controllers/twilio-api.controller';
// import { WhatsappControllers } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-api.controller';
import { ArxChatEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-chat-agent.controller';
import { GoogleControllers } from 'src/engine/core-modules/arx-chat/controllers/google-calendar-mail-api.controller';
import { MetaWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/meta-whatsapp.controller';
import { WhatsappWebhook } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-webhook.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
// import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
// import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/ext-sock-whatsapp.controller';
import { JwtService } from '@nestjs/jwt/dist/jwt.service';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { WorkspaceSchemaFactory } from 'src/engine/api/graphql/workspace-schema.factory';
import { ArxDeliveryEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-delivery.controller';
import { LinkedinUnipileController } from 'src/engine/core-modules/arx-chat/controllers/linkedin-unipile.controller';
import { UnipileWebhookController } from 'src/engine/core-modules/arx-chat/controllers/unipile-webhook.controller';
import { VideoInterviewProcessController } from 'src/engine/core-modules/arx-chat/controllers/video-interview-process-controller';
import { WhatsappUnipileController } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-unipile.controller';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.controller';
import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { UnipileWebhookService } from 'src/engine/core-modules/arx-chat/services/unipile-webhook.service';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { JwtAuthStrategy } from 'src/engine/core-modules/auth/strategies/jwt.auth.strategy';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { ProcessCandidatesService } from 'src/engine/core-modules/candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/engine/core-modules/candidate-sourcing/services/data-source-transformer-factory.service';
import { ApnaDatabaseTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/apna-database-transformer.service';
import { HiringNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { LinkedInSearchTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { NaukriProfileDataTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/naukri-profile-data-transformer.service';
import { ParsedCVTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/parsed-cv-transformer.service';
import { ResdexNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/uploaded-profiles-transformer.service';
import { JDParserService } from 'src/engine/core-modules/candidate-sourcing/services/jd-parser.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { GoogleContactsModule } from 'src/engine/core-modules/google-contacts/google-contacts.module';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { GraphQLExecutionService } from 'src/engine/core-modules/graphql/graphql-execution.service';
import { SchemaCacheService } from 'src/engine/core-modules/graphql/services/schema-cache.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import { WorkspaceMetadataCacheModule } from 'src/engine/metadata-modules/workspace-metadata-cache/workspace-metadata-cache.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { LinkedinSalesNavigatorTransformerService } from '../candidate-sourcing/services/data-sources/linkedin-sales-navigator-transformer.service';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { CandidateDataProcessorService } from './services/candidate-engagement/candidate-data-processor.service';
import { CandidateEngagementArx } from './services/candidate-engagement/candidate-engagement';
import { EngagedCandidateProcessor } from './services/candidate-engagement/engaged-candidate-processor.job';
import { EngagedCandidateQueueService } from './services/candidate-engagement/engaged-candidate-queue.service';
import { GmailDraftShortlistQueueProcessor } from './services/candidate-engagement/gmail-draft-shortlist-queue.job';
import { GmailDraftShortlistQueueService } from './services/candidate-engagement/gmail-draft-shortlist-queue.service';
import { UpdateChat } from './services/candidate-engagement/update-chat';
import { MessagingControls } from './services/messaging-controls';

const isWorker = process.argv[1]?.includes('queue-worker');

const conditionalImports = isWorker
  ? [ExtSockWhatsappWhitelistProcessingService, WhatsappMessageProcessor]
  : [];


@Module({
  imports: [
    GoogleCalendarModule,
    GoogleContactsModule,
    CoreGraphQLApiModule,
    WebSocketModule,
    DataSourceModule, 
    LinkedInSearchModule,
    WorkspaceSchemaBuilderModule,
    FeatureFlagModule,
    WorkspaceResolverBuilderModule,
    WorkspaceMetadataCacheModule,
    AuthModule, 
    GraphQLExecutionModule,
    WorkspaceModificationsModule, 
    CandidateSearchModule,
    CandidateSourcingModule,
    JwtModule,
    TypeORMModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    TypeOrmModule.forFeature([User], 'core'),
    TypeOrmModule.forFeature([AppToken], 'core'),
    TypeOrmModule.forFeature([UserWorkspace], 'core'),
    TypeOrmModule.forFeature([Workspace, FeatureFlag], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
  ],
  controllers: [
    ArxChatEndpoint,
    ArxDeliveryEndpoint,  
    WhatsappWebhook,
    MetaWhatsappController,
    TwilioControllers,
    GoogleControllers,
    VideoInterviewProcessController,
    ExtSockWhatsappController,
    LinkedinUnipileController,
    WhatsappUnipileController,
    UnipileWebhookController,
  ],
  providers: [
    PersonService,
    GraphQLExecutionService,
    CandidateService,
    RedisService,
    ResumeReadParseUploadService,
    JDParserService,
    ExtSockWhatsappMessageProcessor,
    ...conditionalImports,
    ExtSockWhatsappService,
    WorkspaceDataSourceService,
    WorkspaceCacheStorageService,
    ParsedCVTransformerService,
    ApiKeyService,
    WorkspaceSchemaFactory,
    JwtWrapperService,
    SchemaCacheService,
    LinkedInSearchTransformerService,
    LinkedInSessionTrackerService,  
    JwtService,
    GoogleSheetsService,
    WebSocketGateway,
    ProcessCandidatesService,
    EnvironmentService,
    JwtAuthStrategy,
    EmailService,
    WebSocketService,
    AccessTokenService,
    CandidateEngagementArx,
    CandidateDataProcessorService,
    UpdateChat,
    MessagingControls,
    DataSourceTransformerFactoryService,
    ResdexNaukriTransformerService,
    HiringNaukriTransformerService,
    LinkedinPremiumTransformerService,
    LinkedinSalesNavigatorTransformerService,
    SpreadsheetImportTwentyTransformerService,
    RmsNaukriTransformerService,
    ApnaDatabaseTransformerService,
    NaukriProfileDataTransformerService,
    UploadedProfilesTransformerService,
    LinkedinRecruiterJobsTransformerService,
    LinkedinPremiumJobsTransformerService,
    DataProcessingUtils,
    EngagedCandidateQueueService,
    EngagedCandidateProcessor,
    GmailDraftShortlistQueueService,
    GmailDraftShortlistQueueProcessor,
    UnipileWebhookService,
    LinkedinParameterResolver,
  ],
  exports: [ExtSockWhatsappService, CandidateEngagementArx],
})
export class ArxChatAgentModule {}
