import { Module } from '@nestjs/common';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { AssistantModule } from '../assistant/assistant.module';
import { MessageQueueModule } from '../message-queue/message-queue.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { AutonomousRecruiterCronService } from './autonomous-recruiter-cron.service';
import { AutonomousRecruiterProcessor } from './autonomous-recruiter.processor';

@Module({
  imports: [MessageQueueModule, WorkspaceModificationsModule, AssistantModule, WebSocketModule],
  providers: [AutonomousRecruiterProcessor, AutonomousRecruiterCronService],
})
export class AutonomousRecruiterModule {}
