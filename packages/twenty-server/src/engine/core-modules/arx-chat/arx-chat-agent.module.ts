import { Module } from '@nestjs/common';

import { RecruitmentAgentController, UpdateChatEndpoint, WhatsappTestAPI, WhatsappWebhook } from 'src/engine/core-modules/arx-chat/arx-chat-agent.controller';
import { TasksService } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';



@Module({
  imports: [AuthModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class ArxChatAgentModule {}
