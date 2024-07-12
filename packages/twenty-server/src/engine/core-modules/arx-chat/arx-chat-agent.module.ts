import { Module } from '@nestjs/common';

import { ArxChatEndpoint, UpdateChatEndpoint, WhatsappControllers, WhatsappWebhook,WhatsappTestAPI } from 'src/engine/core-modules/arx-chat/arx-chat-agent.controller';
import { TasksService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GoogleCalendarController } from 'src/engine/core-modules/calendar-events/google-calendar.controller';
import { GoogleCalendarModule } from 'src/engine/core-modules/calendar-events/google-calendar.module';

@Module({
  imports: [AuthModule, GoogleCalendarModule],
  controllers: [ArxChatEndpoint, UpdateChatEndpoint, WhatsappWebhook, WhatsappControllers,WhatsappTestAPI],
  providers: [TasksService],
  exports: [],
})
export class ArxChatAgentModule {}
