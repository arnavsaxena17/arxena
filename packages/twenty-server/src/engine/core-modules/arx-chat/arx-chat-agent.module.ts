import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';

import { ArxChatEndpoint, UpdateChatEndpoint, WhatsappControllers, WhatsappWebhook,WhatsappTestAPI,TwilioControllers, GoogleControllers } from 'src/engine/core-modules/arx-chat/arx-chat-agent.controller';
import { TasksService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarController } from 'src/engine/core-modules/calendar-events/google-calendar.controller';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';
import { Workspace } from '../workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module'; // Add this import


@Module({
  
  imports: [AuthModule,  GoogleCalendarModule,     DataSourceModule, TypeORMModule, TypeOrmModule.forFeature([Workspace, FeatureFlagEntity], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata') ],
  controllers: [ArxChatEndpoint, UpdateChatEndpoint, WhatsappWebhook, WhatsappControllers,WhatsappTestAPI,TwilioControllers, GoogleControllers],
  providers: [TasksService, WorkspaceDataSourceService],
  exports: [],
})
export class ArxChatAgentModule {}
