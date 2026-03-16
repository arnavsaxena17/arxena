import { Module } from '@nestjs/common';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { RecruiterMessageService } from 'src/engine/core-modules/autonomous-recruiter/recruiter-message.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { AssistantModule } from '../assistant/assistant.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { MessageQueueModule } from '../message-queue/message-queue.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { AutonomousRecruiterCronService } from './autonomous-recruiter-cron.service';
import { AutonomousRecruiterController } from './autonomous-recruiter.controller';
import { AutonomousRecruiterProcessor } from './autonomous-recruiter.processor';
import { JobContextService } from './job-context.service';

@Module({
  imports: [
    MessageQueueModule,
    WorkspaceModificationsModule,
    AssistantModule,
    WebSocketModule,
    GraphQLExecutionModule,
    AuthModule,
  ],
  controllers: [AutonomousRecruiterController],
  providers: [
    AutonomousRecruiterProcessor,
    AutonomousRecruiterCronService,
    JobContextService,
    RecruiterMessageService,
    WorkspaceCacheStorageService,
  ],
})
export class AutonomousRecruiterModule {}
