import { Module } from '@nestjs/common';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { RecruiterMessageService } from 'src/engine/core-modules/autonomous-recruiter/recruiter-message.service';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { AssistantModule } from '../assistant/assistant.module';
import { CandidateSearchModule } from '../candidate-search/candidate-search.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { MessageQueueModule } from '../message-queue/message-queue.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { AutonomousRecruiterCronService } from './autonomous-recruiter-cron.service';
import { AutonomousRecruiterController } from './autonomous-recruiter.controller';
import { AutonomousRecruiterProcessor } from './autonomous-recruiter.processor';
import { ProjectContextService } from './project-context.service';

/**
 * Host leftover: autonomous recruiter orchestration (cron/queue/demo SSE) over
 * Assistant + MCP. No CRM objects of its own — requires the Assistant app for
 * `assistantThread` persistence. Skips heartbeats when threads are unavailable.
 */
@Module({
  imports: [
    MessageQueueModule,
    WorkspaceModificationsModule,
    AssistantModule,
    WebSocketModule,
    GraphQLExecutionModule,
    AuthModule,
    CandidateSearchModule,
  ],
  controllers: [AutonomousRecruiterController],
  providers: [
    AutonomousRecruiterProcessor,
    AutonomousRecruiterCronService,
    ProjectContextService,
    RecruiterMessageService,
    WorkspaceCacheStorageService,
  ],
})
export class AutonomousRecruiterModule {}
