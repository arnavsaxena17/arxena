import { Module } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { WorkspaceQueryRunnerModule } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-runner.module';
import { ActorModule } from 'src/engine/core-modules/actor/actor.module';
import { AdminPanelModule } from 'src/engine/core-modules/admin-panel/admin-panel.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { ApplicationDevelopmentModule } from 'src/engine/core-modules/application/application-development/application-development.module';
import { ApplicationInstallModule } from 'src/engine/core-modules/application/application-install/application-install.module';
import { MarketplaceModule } from 'src/engine/core-modules/application/application-marketplace/marketplace.module';
import { ApplicationOAuthModule } from 'src/engine/core-modules/application/application-oauth/application-oauth.module';
import { ApplicationRegistrationModule } from 'src/engine/core-modules/application/application-registration/application-registration.module';
import { ApplicationUpgradeModule } from 'src/engine/core-modules/application/application-upgrade/application-upgrade.module';
import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { PreInstalledAppsModule } from 'src/engine/core-modules/application/pre-installed-apps/pre-installed-apps.module';
import { ApprovedAccessDomainModule } from 'src/engine/core-modules/approved-access-domain/approved-access-domain.module';
import { ArxChatAgentModule } from 'src/engine/core-modules/arx-chat/arx-chat-agent.module';
import { AssistantModule } from 'src/engine/core-modules/assistant/assistant.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { AutonomousRecruiterModule } from 'src/engine/core-modules/autonomous-recruiter/autonomous-recruiter.module';
import { BillingWebhookModule } from 'src/engine/core-modules/billing-webhook/billing-webhook.module';
import { AppBillingModule } from 'src/engine/core-modules/billing/app-billing/app-billing.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { McpFederationModule } from 'src/engine/core-modules/mcp-federation/mcp-federation.module';
import { BillingGraphqlApiExceptionFilter } from 'src/engine/core-modules/billing/filters/billing-graphql-api-exception.filter';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { TimelineCalendarEventModule } from 'src/engine/core-modules/calendar/timeline-calendar-event.module';
import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { CaptchaModule } from 'src/engine/core-modules/captcha/captcha.module';
import { CloudflareModule } from 'src/engine/core-modules/cloudflare/cloudflare.module';
import { CodeInterpreterModule } from 'src/engine/core-modules/code-interpreter/code-interpreter.module';
import { CodeInterpreterSessionCleanupModule } from 'src/engine/core-modules/code-interpreter/crons/code-interpreter-session-cleanup.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { DnsManagerModule } from 'src/engine/core-modules/dns-manager/dns-manager.module';
import { DpaModule } from 'src/engine/core-modules/dpa/dpa.module';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { EmailingDomainModule } from 'src/engine/core-modules/emailing-domain/emailing-domain.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { ExceptionHandlerModule } from 'src/engine/core-modules/exception-handler/exception-handler.module';
import { exceptionHandlerModuleFactory } from 'src/engine/core-modules/exception-handler/exception-handler.module-factory';
import { ExtensionBridgeModule } from 'src/engine/core-modules/extension-bridge/extension-bridge.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { GeoMapModule } from 'src/engine/core-modules/geo-map/geo-map-module';
import { MailerModule } from 'src/engine/core-modules/gmail-sender/gmail-sender.module';
import { GoogleDriveModule } from 'src/engine/core-modules/google-drive/google-drive.module';
import { HealthModule } from 'src/engine/core-modules/health/health.module';
import { ImapSmtpCaldavModule } from 'src/engine/core-modules/imap-smtp-caldav-connection/imap-smtp-caldav-connection.module';
import { ImpersonationModule } from 'src/engine/core-modules/impersonation/impersonation.module';
import { LabModule } from 'src/engine/core-modules/lab/lab.module';
import { SerpCompanySearchModule } from 'src/engine/core-modules/linkedin-company-search/linkedin-company-search.module';
import { LinkedinQueryGenerationModule } from 'src/engine/core-modules/linkedin-query-generation/linkedin-query-generation.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LLMChatModelModule } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module';
import { llmChatModelModuleFactory } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module-factory';
import { LLMTracingModule } from 'src/engine/core-modules/llm-tracing/llm-tracing.module';
import { llmTracingModuleFactory } from 'src/engine/core-modules/llm-tracing/llm-tracing.module-factory';
import { LoggerModule } from 'src/engine/core-modules/logger/logger.module';
import { loggerModuleFactory } from 'src/engine/core-modules/logger/logger.module-factory';
import { LogicFunctionModule } from 'src/engine/core-modules/logic-function/logic-function.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { messageQueueModuleFactory } from 'src/engine/core-modules/message-queue/message-queue.module-factory';
import { TimelineMessagingModule } from 'src/engine/core-modules/messaging/timeline-messaging.module';
import { MetricsModule } from 'src/engine/core-modules/metrics/metrics.module';
import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { OpenApiModule } from 'src/engine/core-modules/open-api/open-api.module';
import { OrgChartEmbedModule } from 'src/engine/core-modules/org-chart-embed/org-chart-embed.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { PeopleApiModule } from 'src/engine/core-modules/people-api/people-api.module';
import { PrivacyConsentModule } from 'src/engine/core-modules/privacy-consent/privacy-consent.module';
import { PublicDomainModule } from 'src/engine/core-modules/public-domain/public-domain.module';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { SearchModelsModule } from 'src/engine/core-modules/search-models/search-models.module';
import { SearchModule } from 'src/engine/core-modules/search/search.module';
import { WorkspaceSSOModule } from 'src/engine/core-modules/sso/sso.module';
import { TelemetryModule } from 'src/engine/core-modules/telemetry/telemetry.module';
import { TheOfficialBoardModule } from 'src/engine/core-modules/theofficialboard/theofficialboard.module';
import { TheOrgModule } from 'src/engine/core-modules/theorg/theorg.module';
import { TwentyConfigModule } from 'src/engine/core-modules/twenty-config/twenty-config.module';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UnipileAttachmentModule } from 'src/engine/core-modules/unipile-attachments/unipile-attachment.module';
import { UsageModule } from 'src/engine/core-modules/usage/usage.module';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { VideoInterviewModule } from 'src/engine/core-modules/video-interview/video-interview.module';
import { WebsiteLeadsModule } from 'src/engine/core-modules/website-leads/website-leads.module';
import { WellKnownModule } from 'src/engine/core-modules/well-known/well-known.module';
import { WhatsappMediaModule } from 'src/engine/core-modules/whatsapp-media/whatsapp-media.module';
import { WorkflowApiModule } from 'src/engine/core-modules/workflow/workflow-api.module';
import { WorkspaceInvitationModule } from 'src/engine/core-modules/workspace-invitation/workspace-invitation.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';
import { PageLayoutModule } from 'src/engine/metadata-modules/page-layout/page-layout.module';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';
import { RoleModule } from 'src/engine/metadata-modules/role/role.module';
import { RowLevelPermissionModule } from 'src/engine/metadata-modules/row-level-permission-predicate/row-level-permission.module';
import { SubscriptionsModule } from 'src/engine/subscriptions/subscriptions.module';
import { TrashCleanupModule } from 'src/engine/trash-cleanup/trash-cleanup.module';
import { WorkspaceEventEmitterModule } from 'src/engine/workspace-event-emitter/workspace-event-emitter.module';
import { CreateCalendarEventModule } from 'src/modules/calendar/calendar-event-creation-manager/create-calendar-event.module';
import { ConnectedAccountSyncWebhooksModule } from 'src/modules/connected-account-sync-webhooks/connected-account-sync-webhooks.module';
import { ChannelSyncModule } from 'src/modules/connected-account/channel-sync/channel-sync.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { EmailingModule } from 'src/modules/emailing/emailing.module';
import { MessagingWebhooksModule } from 'src/modules/messaging-webhooks/messaging-webhooks.module';
import { SendEmailModule } from 'src/modules/messaging/message-outbound-manager/send-email.module';
import { ClientConfigModule } from './client-config/client-config.module';
import { EventLogsViewerModule } from './event-logs/event-logs-viewer.module';
import { FileModule } from './file/file.module';

@Module({
  imports: [
    EnvironmentModule,
    TwentyConfigModule.forRoot(),
    HealthModule,
    AuthModule,
    BillingModule,
    BillingWebhookModule,
    MessagingWebhooksModule,
    ConnectedAccountSyncWebhooksModule,
    UsageModule,
    ClientConfigModule,
    FeatureFlagModule,
    FileModule,
    RowLevelPermissionModule,
    OpenApiModule,
    WellKnownModule,
    ApplicationRegistrationModule,
    ApplicationOAuthModule,
    ApplicationModule,
    ApplicationInstallModule,
    ApplicationUpgradeModule,
    ApplicationDevelopmentModule,
    MarketplaceModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    WorkspaceInvitationModule,
    WorkspaceSSOModule,
    ApprovedAccessDomainModule,
    EmailingDomainModule,
    EmailingModule,
    PublicDomainModule,
    CloudflareModule,
    DnsManagerModule,
    WorkflowApiModule,
    WorkspaceEventEmitterModule,
    ActorModule,
    TelemetryModule,
    AdminPanelModule,
    LabModule,
    RoleModule,
    RedisClientModule,
    WorkspaceQueryRunnerModule,
    GeoMapModule,
    SubscriptionsModule,
    ImapSmtpCaldavModule,
    ChannelSyncModule,
    SendEmailModule,
    CreateCalendarEventModule,
    FileStorageModule.forRoot(),
    LoggerModule.forRootAsync({
      useFactory: loggerModuleFactory,
      inject: [TwentyConfigService],
    }),
    MetricsModule,
    MessageQueueModule.registerAsync({
      useFactory: messageQueueModuleFactory,
      inject: [TwentyConfigService, RedisClientService, MetricsService],
    }),
    ExceptionHandlerModule.forRootAsync({
      useFactory: exceptionHandlerModuleFactory,
      inject: [TwentyConfigService, HttpAdapterHost],
    }),
    EmailModule.forRoot(),
    CaptchaModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    CacheStorageModule,
    AiModelsModule,
    AiBillingModule,
    LogicFunctionModule.forRoot(),
    CodeInterpreterModule.forRoot(),
    SearchModule,
    ApiKeyModule,
    DpaModule,
    PageLayoutModule,
    ImpersonationModule,
    TrashCleanupModule,
    CodeInterpreterSessionCleanupModule,
    DashboardModule,
    EventLogsViewerModule,
    PreInstalledAppsModule,
    AppBillingModule,
    // Arxena product modules (ported from workflows)
    CandidateSearchModule,
    CandidateSourcingModule,
    ContactEnrichmentModule,
    CandidateAvatarModule,
    AssistantModule,
    McpFederationModule,
    AutonomousRecruiterModule,
    ExtensionBridgeModule,
    SearchModelsModule,
    TheOrgModule,
    TheOfficialBoardModule,
    LinkedinQueryGenerationModule,
    SerpCompanySearchModule,
    LinkedInSearchModule,
    PeopleApiModule,
    ArxChatAgentModule,
    GoogleCalendarModule,
    GoogleDriveModule,
    MailerModule,
    VideoInterviewModule,
    WorkspaceModificationsModule,
    WhatsappMediaModule,
    UnipileAttachmentModule,
    OrgChartModule,
    OrgChartEmbedModule,
    WebsiteLeadsModule,
    PrivacyConsentModule,
    LLMChatModelModule.forRoot({
      useFactory: llmChatModelModuleFactory,
      inject: [EnvironmentService],
    }),
    LLMTracingModule.forRoot({
      useFactory: llmTracingModuleFactory,
      inject: [EnvironmentService],
    }),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: BillingGraphqlApiExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PermissionsGraphqlApiExceptionFilter,
    },
  ],
  exports: [
    EventLogsViewerModule,
    AuthModule,
    FeatureFlagModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    WorkspaceInvitationModule,
    WorkspaceSSOModule,
    ImapSmtpCaldavModule,
    WorkspaceModificationsModule,
    ArxChatAgentModule,
    CandidateSearchModule,
    CandidateSourcingModule,
    AssistantModule,
    OrgChartModule,
    OrgChartEmbedModule,
    VideoInterviewModule,
  ],
})
export class CoreEngineModule {}
