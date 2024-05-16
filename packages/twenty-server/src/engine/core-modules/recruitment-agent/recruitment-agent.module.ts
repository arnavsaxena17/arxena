import { Module } from '@nestjs/common';

import { RecruitmentAgentController, UpdateChatEndpoint, WhatsappTestAPI, WhatsappWebhook } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.controller';
import { TasksService } from 'src/engine/core-modules/recruitment-agent/services/databaseActions/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';


@Module({
  imports: [AuthModule],
  controllers: [RecruitmentAgentController,UpdateChatEndpoint,WhatsappWebhook,WhatsappTestAPI],
  providers: [TasksService],
  exports: [],
})
export class RecruitmentAgentModule {}
