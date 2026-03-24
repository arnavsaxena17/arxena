import { Module } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { ActorModule } from 'src/engine/core-modules/actor/actor.module';
import { AdminPanelModule } from 'src/engine/core-modules/admin-panel/admin-panel.module';
import { AppTokenModule } from 'src/engine/core-modules/app-token/app-token.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { TimelineCalendarEventModule } from 'src/engine/core-modules/calendar/timeline-calendar-event.module';
import { CaptchaModule } from 'src/engine/core-modules/captcha/captcha.module';
import { captchaModuleFactory } from 'src/engine/core-modules/captcha/captcha.module-factory';
import { CronProcessesModule } from 'src/engine/core-modules/cron-processes/cron-processes.module';
import { EmailModule } from 'src/engine/core-modules/email/email.module';
import { emailModuleFactory } from 'src/engine/core-modules/email/email.module-factory';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { ExceptionHandlerModule } from 'src/engine/core-modules/exception-handler/exception-handler.module';
import { exceptionHandlerModuleFactory } from 'src/engine/core-modules/exception-handler/exception-handler.module-factory';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileStorageModule } from 'src/engine/core-modules/file-storage/file-storage.module';
import { fileStorageModuleFactory } from 'src/engine/core-modules/file-storage/file-storage.module-factory';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
// import { GoogleContactsModule } from 'src/engine/core-modules/google-contacts/google-contacts.module';
import { HealthModule } from 'src/engine/core-modules/health/health.module';
import { LabModule } from 'src/engine/core-modules/lab/lab.module';
import { LinkedinQueryGenerationModule } from 'src/engine/core-modules/linkedin-query-generation/linkedin-query-generation.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { LLMChatModelModule } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module';
import { llmChatModelModuleFactory } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module-factory';
import { LLMTracingModule } from 'src/engine/core-modules/llm-tracing/llm-tracing.module';
import { llmTracingModuleFactory } from 'src/engine/core-modules/llm-tracing/llm-tracing.module-factory';
import { LoggerModule } from 'src/engine/core-modules/logger/logger.module';
import { loggerModuleFactory } from 'src/engine/core-modules/logger/logger.module-factory';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { messageQueueModuleFactory } from 'src/engine/core-modules/message-queue/message-queue.module-factory';
import { TimelineMessagingModule } from 'src/engine/core-modules/messaging/timeline-messaging.module';
import { OpenApiModule } from 'src/engine/core-modules/open-api/open-api.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { PostgresCredentialsModule } from 'src/engine/core-modules/postgres-credentials/postgres-credentials.module';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { serverlessModuleFactory } from 'src/engine/core-modules/serverless/serverless-module.factory';
import { ServerlessModule } from 'src/engine/core-modules/serverless/serverless.module';
import { WorkspaceSSOModule } from 'src/engine/core-modules/sso/sso.module';
import { TelemetryModule } from 'src/engine/core-modules/telemetry/telemetry.module';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { VideoInterviewModule } from 'src/engine/core-modules/video-interview/video-interview.module';
import { WorkflowApiModule } from 'src/engine/core-modules/workflow/workflow-api.module';
import { WorkspaceInvitationModule } from 'src/engine/core-modules/workspace-invitation/workspace-invitation.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { RoleModule } from 'src/engine/metadata-modules/role/role.module';
import { WorkspaceEventEmitterModule } from 'src/engine/workspace-event-emitter/workspace-event-emitter.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ArxChatAgentModule } from './arx-chat/arx-chat-agent.module';
import { AssistantModule } from './assistant/assistant.module';
import { AutonomousRecruiterModule } from './autonomous-recruiter/autonomous-recruiter.module';
import { CandidateSearchModule } from './candidate-search/candidate-search.module';
import { CandidateSourcingModule } from './candidate-sourcing/candidate-sourcing.module';
import { ClientConfigModule } from './client-config/client-config.module';
import { ContactEnrichmentModule } from './contact-enrichment/contact-enrichment.module';
import { ExtensionBridgeModule } from './extension-bridge/extension-bridge.module';
import { FileModule } from './file/file.module';
import { MailerModule } from './gmail-sender/gmail-sender.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
// import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { SearchModelsModule } from './search-models/search-models.module';
import { TheOrgModule } from './theorg/theorg.module';
import { WhiskeySocketsBaileysWhatsappModule } from './whiskeysocket-baileys/whiskeysocket-baileys.module';
// import { RecruitmentAgentModule } from "src/engine/core-modules/recruitment-agent/recruitment-agent.module";

const isWorker = process?.argv[1]?.includes('queue-worker');

console.log(`process.env.NODE_ENV: ${process.env.NODE_ENV}`);

const isLocalTesting = false;

const conditionalImports = (isWorker || isLocalTesting)
  ? []
  : [WhiskeySocketsBaileysWhatsappModule, CronProcessesModule];

const conditionalExports = (isWorker || isLocalTesting)
  ? []
  : [WhiskeySocketsBaileysWhatsappModule];

  
  console.log(`conditionalExports: ${conditionalExports}`);
@Module({
  imports: [
    HealthModule,
    AnalyticsModule,
    AuthModule,
    BillingModule,
    ClientConfigModule,
    FeatureFlagModule,
    CandidateSearchModule,
    CandidateSourcingModule,
    ContactEnrichmentModule,
    AssistantModule,
    AutonomousRecruiterModule,
    ExtensionBridgeModule,
    SearchModelsModule,
    TheOrgModule,
    LinkedinQueryGenerationModule,
    // BaileysModule,
    // ...conditionalImports,
    // GoogleSheetsModule,
    GoogleDriveModule,
    FileModule,
    OpenApiModule,
    ArxChatAgentModule,
    GoogleCalendarModule,
    // GoogleContactsModule,
    MailerModule,
    VideoInterviewModule,
    AppTokenModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    WorkspaceInvitationModule,
    WorkspaceSSOModule,
    PostgresCredentialsModule,
    WorkflowApiModule,
    WorkspaceEventEmitterModule,
    ActorModule,
    TelemetryModule,
    AdminPanelModule,
    WorkspaceModificationsModule,
    LabModule,
    LinkedInSearchModule,
    OrgChartModule,
    RoleModule,
    EnvironmentModule.forRoot({}),
    RedisClientModule,
    FileStorageModule.forRootAsync({
      useFactory: fileStorageModuleFactory,
      inject: [EnvironmentService],
    }),
    LoggerModule.forRootAsync({
      useFactory: loggerModuleFactory,
      inject: [EnvironmentService],
    }),
    MessageQueueModule.registerAsync({
      useFactory: messageQueueModuleFactory,
      inject: [EnvironmentService, RedisClientService],
    }),
    ExceptionHandlerModule.forRootAsync({
      useFactory: exceptionHandlerModuleFactory,
      inject: [EnvironmentService, HttpAdapterHost],
    }),
    EmailModule.forRoot({
      useFactory: emailModuleFactory,
      inject: [EnvironmentService],
    }),
    CaptchaModule.forRoot({
      useFactory: captchaModuleFactory,
      inject: [EnvironmentService],
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
    }),
    CacheStorageModule,
    LLMChatModelModule.forRoot({
      useFactory: llmChatModelModuleFactory,
      inject: [EnvironmentService],
    }),
    LLMTracingModule.forRoot({
      useFactory: llmTracingModuleFactory,
      inject: [EnvironmentService],
    }),
    ServerlessModule.forRootAsync({
      useFactory: serverlessModuleFactory,
      inject: [EnvironmentService, FileStorageService],
    }),
  ],
  exports: [
    AnalyticsModule,
    AuthModule,
    FeatureFlagModule,
    TimelineMessagingModule,
    // BaileysModule,
    // ...conditionalExports,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    WorkspaceModificationsModule,
    ArxChatAgentModule,
    GoogleCalendarModule,
    // GoogleContactsModule,
    MailerModule,
    VideoInterviewModule,
    CandidateSearchModule,
    CandidateSourcingModule,
    AssistantModule,
    SearchModelsModule,
    TheOrgModule,
    LinkedinQueryGenerationModule,
    // GoogleSheetsModule,
    GoogleDriveModule,
    LinkedInSearchModule,
    OrgChartModule,
    WorkspaceInvitationModule,
    WorkspaceSSOModule,
  ],
})
export class CoreEngineModule {}
