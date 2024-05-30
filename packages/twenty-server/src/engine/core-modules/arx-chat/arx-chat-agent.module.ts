import { Module } from '@nestjs/common';

import { ArxChatAgentController, UpdateChatEndpoint, WhatsappWebhook } from 'src/engine/core-modules/arx-chat/arx-chat-agent.controller';
import { TasksService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';



@Module({
  imports: [AuthModule],
  controllers: [ArxChatAgentController, UpdateChatEndpoint, WhatsappWebhook],
  providers: [TasksService],
  exports: [],
})
export class ArxChatAgentModule {}
