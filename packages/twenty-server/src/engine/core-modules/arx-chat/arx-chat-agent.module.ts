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
import { VideoInterviewProcessController } from 'src/engine/core-modules/arx-chat/controllers/video-interview-process-controller';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from 'src/engine/core-modules/candidate-sourcing/services/person.service';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
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
  ],
  // providers: [CandidateStatusClassificationCronService, WebhookTestCronService, PersonService,CandidateEngagementCronService, CandidateService, WorkspaceDataSourceService],
  providers: [
    CandidateStatusClassificationCronService,
    PersonService,
    CandidateEngagementCronService,
    CandidateService,
    WorkspaceDataSourceService,
    WorkspaceCacheStorageService,
    ApiKeyService,
  ],
  exports: [],
})
export class ArxChatAgentModule {}
