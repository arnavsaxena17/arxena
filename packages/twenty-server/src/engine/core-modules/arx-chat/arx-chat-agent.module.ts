import { ArxWebSearchModule } from 'src/engine/core-modules/arx-web-search/arx-web-search.module';
import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
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
import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.controller';
import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { UnipileAccountPoolService } from 'src/engine/core-modules/arx-chat/services/unipile-account-pool.service';
import { UnipileWebhookProcessor } from 'src/engine/core-modules/arx-chat/services/unipile-webhook.processor.job';
import { UnipileWebhookService } from 'src/engine/core-modules/arx-chat/services/unipile-webhook.service';
import { VoiceCallService } from 'src/engine/core-modules/arx-chat/services/voice-call/voice-call.service';
import { WorkflowApprovalModule } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-approval.module';
import { WhatsappOutboundRateLimiterService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-outbound-rate-limiter.service';
import { WorkspaceMemberUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-unipile.service';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { CandidateDataSourcesModule } from 'src/engine/core-modules/candidate-data-sources/candidate-data-sources.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { GoogleContactsModule } from 'src/engine/core-modules/google-contacts/google-contacts.module';
import { GoogleConnectedAccountAuthModule } from 'src/engine/core-modules/google-auth/google-connected-account-auth.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import { IcpExtractionService } from 'src/engine/core-modules/org-chart-outreach/icp-extraction.service';
import { IcpOutreachMessageService } from 'src/engine/core-modules/org-chart-outreach/icp-outreach-message.service';
import { LinkedinOutreachOpenerService } from 'src/engine/core-modules/org-chart-outreach/linkedin-outreach-opener.service';
import { OrgChartOutreachController } from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.controller';
import { OrgChartOutreachService } from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.service';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { UnipileAttachmentModule } from 'src/engine/core-modules/unipile-attachments/unipile-attachment.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WarmPathsModule } from 'src/engine/core-modules/warm-paths/warm-paths.module';
import { WhatsappAgentModule } from 'src/engine/core-modules/whatsapp-agent/whatsapp-agent.module';
import { WhatsappMediaModule } from 'src/engine/core-modules/whatsapp-media/whatsapp-media.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';
import { FeatureFlagModule } from '../feature-flag/feature-flag.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { CandidateDataProcessorService } from './services/candidate-engagement/candidate-data-processor.service';
import { CandidateEngagementArx } from './services/candidate-engagement/candidate-engagement';
import { CandidateEngagementDataUpdateService } from './services/candidate-engagement/candidate-engagement-data-update.service';
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
import { UnipilePoolModule } from './unipile-pool.module';
import { MeteredLlmModule } from 'src/engine/core-modules/metered-llm/metered-llm.module';

const isWorker = process.argv[1]?.includes('queue-worker');

const conditionalImports = isWorker
  ? [ExtSockWhatsappWhitelistProcessingService, WhatsappMessageProcessor]
  : [];

@Module({
  imports: [
    MeteredLlmModule,
    ArxWebSearchModule,
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
    CandidateSourcingModule,
    CandidateDataSourcesModule,
    ContactEnrichmentModule,
    JwtModule,
    UnipilePoolModule,
    OutreachCommandModule,
    WorkflowApprovalModule,
    OrgChartModule,
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
    OrgChartOutreachController,
    WorkflowFormWhatsappController,
    WorkflowApprovalController,
  ],
  providers: [
    CalendarEmailService,
    ...conditionalImports,
    ExtSockWhatsappService,
    LinkedInSessionTrackerService,
    WebSocketGateway,
    WebSocketService,
    CandidateEngagementArx,
    CandidateEngagementDataUpdateService,
    VoiceCallService,
    CandidateDataProcessorService,
    UpdateChat,
    CandidateChatControlListener,
    MessagingControls,
    EngagedCandidateQueueService,
    EngagedCandidateProcessor,
    GmailDraftShortlistQueueService,
    GmailDraftShortlistQueueProcessor,
    UnipileWebhookService,
    UnipileWebhookProcessor,
    WorkspaceMemberUnipileService,
    WhatsappOutboundRateLimiterService,
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
    OrgChartOutreachService,
    LinkedinOutreachOpenerService,
    IcpExtractionService,
    IcpOutreachMessageService,
  ],
  exports: [
    ExtSockWhatsappService,
    CandidateEngagementArx,
    WhatsAppMonitoringUnifiedService,
    LinkedInUnipileMonitoringService,
  ],
})
export class ArxChatAgentModule {}
