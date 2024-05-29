import { Module } from '@nestjs/common';

import { WorkspaceModule } from 'src/engine/core-modules/workspace/workspace.module';
import { UserModule } from 'src/engine/core-modules/user/user.module';
import { AppTokenModule } from 'src/engine/core-modules/app-token/app-token.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { OpenApiModule } from 'src/engine/core-modules/open-api/open-api.module';
import { TimelineMessagingModule } from 'src/engine/core-modules/messaging/timeline-messaging.module';
import { TimelineCalendarEventModule } from 'src/engine/core-modules/calendar/timeline-calendar-event.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { HealthModule } from 'src/engine/core-modules/health/health.module';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { BaileysModule } from './baileys/baileys.module';
// import { ArxChatModule } from './arx-chat/arx-chat-agent.module'
import { RecruitmentAgentModule } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.module';
import { VideoInterviewModule } from 'src/engine/core-modules/video-interview/video-interview.module';



import { AnalyticsModule } from './analytics/analytics.module';
import { FileModule } from './file/file.module';
import { ClientConfigModule } from './client-config/client-config.module';

@Module({
  imports: [
    TwentyORMModule.register({
      workspaceEntities: ['dist/src/**/*.workspace-entity{.ts,.js}'],
    }),
    HealthModule,
    AnalyticsModule,
    AuthModule,
    BillingModule,
    ClientConfigModule,
    RecruitmentAgentModule,
    FeatureFlagModule,
    FileModule,
    OpenApiModule,
    AppTokenModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
  ],
  exports: [
    AnalyticsModule,
    AuthModule,
    RecruitmentAgentModule,
    FeatureFlagModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
  ],
})
export class CoreEngineModule {}
