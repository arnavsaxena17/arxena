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
<<<<<<< HEAD
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';
=======
import { PostgresCredentialsModule } from 'src/engine/core-modules/postgres-credentials/postgres-credentials.module';
>>>>>>> origin/dev_ninad
import { BaileysModule } from './baileys/baileys.module';
import { ArxChatAgentModule } from './arx-chat/arx-chat-agent.module'
import { RecruitmentAgentModule } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.module';
import { VideoInterviewModule } from 'src/engine/core-modules/video-interview/video-interview.module';
<<<<<<< HEAD
import { PostgresCredentialsModule } from 'src/engine/core-modules/postgres-credentials/postgres-credentials.module';
=======
>>>>>>> origin/dev_ninad

import { AnalyticsModule } from './analytics/analytics.module';
import { FileModule } from './file/file.module';
import { ClientConfigModule } from './client-config/client-config.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';

@Module({
  imports: [
    GoogleCalendarModule,
    HealthModule,
    AnalyticsModule,
    ArxChatAgentModule,
    AuthModule,
    BillingModule,
    ClientConfigModule,
    // RecruitmentAgentModule,
    FeatureFlagModule,
    FileModule,
    OpenApiModule,
    AppTokenModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    PostgresCredentialsModule,
  ],
  exports: [
    // GoogleCalendarModule,

    AnalyticsModule,
    AuthModule,
    ArxChatAgentModule,
    // RecruitmentAgentModule,
    FeatureFlagModule,
    TimelineMessagingModule,
    TimelineCalendarEventModule,
    UserModule,
    WorkspaceModule,
    // GoogleCalendarModule
  ],
})
export class CoreEngineModule {}