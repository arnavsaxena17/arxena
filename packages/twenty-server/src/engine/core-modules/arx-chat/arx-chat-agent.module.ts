import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';

import { WhatsappWebhook } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-webhook.controller';
import { WhatsappControllers } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-api.controller';
import { TwilioControllers } from 'src/engine/core-modules/arx-chat/controllers/twilio-api.controller';
// import { WebhookTestCronService, WhatsappTestAPI } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-test-api.controller';
import {  WhatsappTestAPI } from 'src/engine/core-modules/arx-chat/controllers/whatsapp-test-api.controller';
import { GoogleControllers } from 'src/engine/core-modules/arx-chat/controllers/google-calendar-mail-api.controller';
import { ArxChatEndpoint } from 'src/engine/core-modules/arx-chat/controllers/arx-chat-agent.controller';
import { CandidateEngagementCronService, CandidateStatusClassificationCronService} from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { Workspace } from '../workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import
import {WorkspaceModificationsModule} from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module'; // Add this import
import { AttachmentProcessingService } from './utils/attachment-processes';
import { CandidateService } from 'src/engine/core-modules/candidate-sourcing/services/candidate.service';
import { PersonService } from '../candidate-sourcing/services/person.service';
import { VideoInterviewProcessController } from './controllers/video-interview-process-controller';

@Module({
  
  imports: [AuthModule,WorkspaceModificationsModule,GoogleCalendarModule,DataSourceModule, TypeORMModule, TypeOrmModule.forFeature([Workspace, FeatureFlagEntity], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata') ],
  controllers: [ArxChatEndpoint,  WhatsappWebhook, WhatsappControllers,WhatsappTestAPI,TwilioControllers, GoogleControllers, VideoInterviewProcessController],
  // providers: [CandidateStatusClassificationCronService, WebhookTestCronService, PersonService,CandidateEngagementCronService, CandidateService, WorkspaceDataSourceService],
  providers: [CandidateStatusClassificationCronService, PersonService,CandidateEngagementCronService, CandidateService, WorkspaceDataSourceService],
  exports: [],
})
export class ArxChatAgentModule {}
