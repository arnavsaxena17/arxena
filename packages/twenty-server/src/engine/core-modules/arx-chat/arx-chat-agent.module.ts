import { ArxWebSearchModule } from 'src/domains/discovery/providers/web-evidence/arx-web-search.module';
import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { TwilioControllers } from 'src/engine/core-modules/arx-chat/controllers/twilio-api.controller';
// import { WhatsappControllers } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-api.controller';
import { ArxChatEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-chat-agent.controller';
import { GoogleControllers } from 'src/engine/core-modules/arx-chat/controllers/google-calendar-mail-api.controller';
import { MetaWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/meta-whatsapp.controller';
import { WhatsappWebhook } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-webhook.controller';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { CalendarEmailService } from 'src/engine/core-modules/arx-chat/utils/calendar-email';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
// import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
// import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/ext-sock-whatsapp.controller';
import { CoreGraphQLApiModule } from 'src/engine/api/graphql/core-graphql-api.module';
import { WorkspaceResolverBuilderModule } from 'src/engine/api/graphql/workspace-resolver-builder/workspace-resolver-builder.module';
import { WorkspaceSchemaBuilderModule } from 'src/engine/api/graphql/workspace-schema-builder/workspace-schema-builder.module';
import { ArxDeliveryEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-delivery.controller';
import { CandidateEngagementController } from 'src/engine/core-modules/arx-chat/controllers/candidate-engagement.controller';
import { LinkedinUnipileController } from 'src/engine/core-modules/arx-chat/controllers/linkedin-unipile.controller';
import { CrunchbaseCookiesController } from 'src/engine/core-modules/arx-chat/controllers/crunchbase-cookies.controller';
import { UnipileWebhookController } from 'src/engine/core-modules/arx-chat/controllers/unipile-webhook.controller';
import { VideoInterviewProcessController } from 'src/engine/core-modules/arx-chat/controllers/video-interview-process-controller';
import { VoiceCallController } from 'src/engine/core-modules/arx-chat/controllers/voice-call.controller';
import { WhatsappUnipileController } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-unipile.controller';
import { WorkflowApprovalController } from 'src/engine/core-modules/arx-chat/controllers/workflow-approval.controller';
import { WorkflowFormWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/workflow-form-whatsapp.controller';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.controller';
import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { UnipileAccountPoolService } from 'src/engine/core-modules/arx-chat/services/unipile-account-pool.service';
import { UnipileWebhookProcessor } from 'src/engine/core-modules/arx-chat/services/unipile-webhook.processor.job';
import { UnipileWebhookService } from 'src/engine/core-modules/arx-chat/services/unipile-webhook.service';
import { VoiceCallService } from 'src/engine/core-modules/arx-chat/services/voice-call/voice-call.service';
import { WorkflowApprovalModule } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-approval.module';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceMemberUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-unipile.service';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { CandidateSearchModule } from 'src/domains/planning/candidate-search/candidate-search.module';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { ProcessCandidatesService } from 'src/domains/ingestion/candidate-sourcing/jobs/process-candidates.service';
import { CandidateService } from 'src/domains/ingestion/candidate-sourcing/services/candidate.service';
import { DataSourceTransformerFactoryService } from 'src/domains/ingestion/candidate-sourcing/services/data-source-transformer-factory.service';
import { ApnaDatabaseTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/apna-database-transformer.service';
import { HiringNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/hiring-naukri-transformer.service';
import { LinkedinPremiumJobsTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-premium-jobs-transformer.service';
import { LinkedinPremiumTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-premium-transformer.service';
import { LinkedinRecruiterJobsTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-recruiter-jobs-transformer.service';
import { LinkedInSearchTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { NaukriProfileDataTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/naukri-profile-data-transformer.service';
import { ParsedCVTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/parsed-cv-transformer.service';
import { ResdexNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/resdex-naukri-transformer.service';
import { RmsNaukriTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/rms-naukri-transformer.service';
import { SpreadsheetImportTwentyTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/spreadsheet-import-twenty-transformer.service';
import { UploadedProfilesTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/uploaded-profiles-transformer.service';
import { JDParserService } from 'src/domains/ingestion/candidate-sourcing/services/jd-parser.service';
import { PersonService } from 'src/domains/ingestion/candidate-sourcing/services/person.service';
import { ResumeReadParseUploadService } from 'src/domains/ingestion/candidate-sourcing/services/resume-read-parse-upload.service';
import { DataProcessingUtils } from 'src/domains/ingestion/candidate-sourcing/utils/data-processing.utils';
import { ContactEnrichmentModule } from 'src/domains/discovery/providers/contact-enrichment/contact-enrichment.module';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { GoogleContactsModule } from 'src/engine/core-modules/google-contacts/google-contacts.module';
import { GoogleConnectedAccountAuthModule } from 'src/engine/core-modules/google-auth/google-connected-account-auth.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';
import { LinkedInSessionTrackerService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-session-tracker.service';
import { LLMChatModelModule } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module';
import { OrgChartModule } from 'src/domains/org-graph/org-chart/org-chart.module';
import { UnipileAttachmentModule } from 'src/engine/core-modules/unipile-attachments/unipile-attachment.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WarmPathsModule } from 'src/domains/discovery/warm-paths/warm-paths.module';
import { WhatsappAgentModule } from 'src/engine/core-modules/whatsapp-agent/whatsapp-agent.module';
import { WhatsappMediaModule } from 'src/engine/core-modules/whatsapp-media/whatsapp-media.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { LinkedinSalesNavigatorTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-sales-navigator-transformer.service';
import { OutreachCommandModule } from 'src/domains/engagement/outreach-command/outreach-command.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { CandidateDataProcessorService } from './services/candidate-engagement/candidate-data-processor.service';
import { CandidateEngagementArx } from './services/candidate-engagement/candidate-engagement';
import { EngagedCandidateProcessor } from './services/candidate-engagement/engaged-candidate-processor.job';
import { EngagedCandidateQueueService } from './services/candidate-engagement/engaged-candidate-queue.service';
import { ExtensionUnipileConnectionStatusService } from './services/candidate-engagement/extension-unipile-connection-status.service';
import { GmailDraftShortlistQueueProcessor } from './services/candidate-engagement/gmail-draft-shortlist-queue.job';
import { GmailDraftShortlistQueueService } from './services/candidate-engagement/gmail-draft-shortlist-queue.service';
import { UpdateChat } from './services/candidate-engagement/update-chat';
import { CandidateChatControlListener } from './listeners/candidate-chat-control.listener';
import { LinkedInUnipileMonitoringService } from './services/linkedin-unipile-monitoring.service';
import { LinkedinUnipileRequestService } from './services/linkedin-unipile-request.service';
import { MemberLinkedinUnipileConnectionService } from './services/member-linkedin-unipile-connection.service';
import { MessagingControls } from './services/messaging-controls';
import { UnipileCompanyService } from './services/unipile-company.service';
import { WhatsAppMonitoringUnifiedService } from './services/whatsapp-monitoring-unified.service';
import { WhatsappUnipileRequestService } from './services/whatsapp-unipile-request.service';
import { WhatsappUnipileSyncService } from './services/whatsapp-unipile/whatsapp-unipile-sync.service';
import { MessagingModule } from './messaging.module';
import { UnipilePoolModule } from './unipile-pool.module';
import { AttachmentProcessingService } from './utils/attachment-processes';
import { MeteredLlmModule } from 'src/engine/core-modules/metered-llm/metered-llm.module';

const isWorker = process.argv[1]?.includes('queue-worker');

const conditionalImports = isWorker
  ? [ExtSockWhatsappWhitelistProcessingService, WhatsappMessageProcessor]
  : [];

@Module({
  imports: [
    MeteredLlmModule,
    forwardRef(() => ArxWebSearchModule),
    AccountRateLimitModule,
    WorkspaceCacheStorageModule,
    EmailModule,
    EnvironmentModule,
    WorkspaceDataSourceModule,
    ApiKeyModule,
    GoogleCalendarModule,
    GoogleContactsModule,
    GoogleConnectedAccountAuthModule,
    CoreGraphQLApiModule,
    WebSocketModule,
    DataSourceModule,
    LinkedInSearchModule,
    WarmPathsModule,
    LLMChatModelModule,
    WorkspaceSchemaBuilderModule,
    FeatureFlagModule,
    WorkspaceResolverBuilderModule,
    AuthModule,
    GraphQLExecutionModule,
    WorkspaceModificationsModule,
    CandidateAvatarModule,
    WhatsappMediaModule,
    WhatsappAgentModule,
    UnipileAttachmentModule,
    CandidateSearchModule,
    forwardRef(() => CandidateSourcingModule),
    ContactEnrichmentModule,
    JwtModule,
    UnipilePoolModule,
    MessagingModule,
    OutreachCommandModule,
    WorkflowApprovalModule,
    forwardRef(() => OrgChartModule),
    TypeORMModule,
    TypeOrmModule.forFeature([WorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([AppTokenEntity]),
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
    TypeOrmModule.forFeature([WorkspaceEntity, FeatureFlagEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
  ],
  controllers: [
    ArxChatEndpoint,
    ArxDeliveryEndpoint,
    WhatsappWebhook,
    MetaWhatsappController,
    TwilioControllers,
    GoogleControllers,
    VideoInterviewProcessController,
    VoiceCallController,
    ExtSockWhatsappController,
    LinkedinUnipileController,
    CrunchbaseCookiesController,
    WhatsappUnipileController,
    CandidateEngagementController,
    UnipileWebhookController,
    WorkflowFormWhatsappController,
    WorkflowApprovalController,
  ],
  providers: [
    CalendarEmailService,
    GoogleSheetsService,
    PersonService,
    CandidateService,
    AttachmentProcessingService,
    RedisService,
    ResumeReadParseUploadService,
    JDParserService,
    ExtSockWhatsappMessageProcessor,
    ...conditionalImports,
    ExtSockWhatsappService,
    ParsedCVTransformerService,
    LinkedInSearchTransformerService,
    LinkedInSessionTrackerService,
    WebSocketGateway,
    ProcessCandidatesService,
    WebSocketService,
    CandidateEngagementArx,
    VoiceCallService,
    CandidateDataProcessorService,
    UpdateChat,
    CandidateChatControlListener,
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
    UnipileWebhookProcessor,
    WorkspaceMemberUnipileService,
    MemberLinkedinUnipileConnectionService,
    ExtensionUnipileConnectionStatusService,
    WhatsappUnipileRequestService,
    WhatsappUnipileSyncService,
    LinkedinUnipileRequestService,
    UnipileCompanyService,
    WhatsAppMonitoringUnifiedService,
    LinkedInUnipileMonitoringService,
    UnipileAccountPoolService,
    LinkedinParameterResolver,
  ],
  exports: [
    ExtSockWhatsappService,
    CandidateEngagementArx,
    WhatsAppMonitoringUnifiedService,
    LinkedInUnipileMonitoringService,
  ],
})
export class ArxChatAgentModule {}
