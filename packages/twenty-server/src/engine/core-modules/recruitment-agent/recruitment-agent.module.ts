import { Module } from '@nestjs/common';
import { RecruitmentAgentController, UpdateChatEndpoint, WhatsappTestAPI, WhatsappWebhook } from 'src/engine/core-modules/recruitment-agent/recruitment-agent.controller';
import { TasksService } from 'src/engine/core-modules/recruitment-agent/services/candidate-engagement/scheduling-agent';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
// import { BaileysGateway } from 'src/engine/core-modules/recruitment-agent/services/baileys/callBaileys';
// import { SocketGateway } from 'src/engine/core-modules/baileys/socket-gateway/socket.gateway';


@Module({
  imports: [AuthModule],
  controllers: [RecruitmentAgentController,UpdateChatEndpoint,WhatsappWebhook,WhatsappTestAPI],
  providers: [TasksService],
  exports: [],
})
export class RecruitmentAgentModule {}
