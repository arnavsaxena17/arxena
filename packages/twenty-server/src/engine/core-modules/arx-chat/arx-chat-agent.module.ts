import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { TwilioControllers } from 'src/engine/core-modules/arx-chat/controllers/twilio-api.controller';
import { WhatsappControllers } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-api.controller';
import { WhatsappWebhook } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-webhook.controller';
// import { WebhookTestCronService, WhatsappTestAPI } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-test-api.controller';
import { ArxChatEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-chat-agent.controller';
import { GoogleControllers } from 'src/engine/core-modules/arx-chat/controllers/google-calendar-mail-api.controller';
import { WhatsappTestAPI } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-test-api.controller';
import {
  CandidateEngagementCronService,
  CandidateStatusClassificationCronService,
} from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
// import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { ExtSockWhatsappController } from 'src/engine/core-modules/arx-chat/controllers/ext-sock-whatsapp.controller';
import { VideoInterviewProcessController } from 'src/engine/core-modules/arx-chat/controllers/video-interview-process-controller';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { WhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.job';
import { ExtSockWhatsappService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp.service';
import { ExtSockWhatsappWhitelistProcessingService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whitelist-processing';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

@Module({
  imports: [
    AuthModule,
    JwtModule,
    WorkspaceModificationsModule,
    GoogleCalendarModule,
    DataSourceModule,

    TypeORMModule,
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
    WhatsappWebhook,
    WhatsappControllers,
    WhatsappTestAPI,
    TwilioControllers,
    GoogleControllers,
    VideoInterviewProcessController,
    ExtSockWhatsappController,
  ],
  // providers: [CandidateStatusClassificationCronService, WebhookTestCronService, PersonService,CandidateEngagementCronService, CandidateService, WorkspaceDataSourceService],
  providers: [
    CandidateStatusClassificationCronService,
    PersonService,
    CandidateEngagementCronService,
    CandidateService,
    RedisService,
    ExtSockWhatsappMessageProcessor,
    ExtSockWhatsappWhitelistProcessingService,
    ExtSockWhatsappService,
    WhatsappMessageProcessor,
    WorkspaceDataSourceService,
    WorkspaceCacheStorageService,
    ApiKeyService,
  ],
  exports: [ExtSockWhatsappService],
})
export class ArxChatAgentModule {}
