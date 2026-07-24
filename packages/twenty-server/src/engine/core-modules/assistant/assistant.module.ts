import { forwardRef, Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { AssistantChatStreamService } from './assistant-chat-stream.service';
import { AssistantIterativeQueryService } from './assistant-iterative-query.service';
import { AssistantThreadTableDataService } from './assistant-thread-table-data.service';
import { AssistantThreadService } from './assistant-thread.service';
import { AssistantController } from './assistant.controller';
import { McpAnthropicMessageProcessorService } from './mcp-anthropic-message-processor.service';
import { McpAssistantToolExecutorService } from './mcp-assistant-tool-executor.service';
import { McpAssistantService } from './mcp-assistant.service';
import { McpInProcessToolRunnerService } from './mcp-in-process-tool-runner.service';
import { McpToolCallCacheService } from './mcp-tool-call-cache.service';
import { AutonomousRecruitmentAgentRulesService } from './recruitment-agent-rules.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    WorkspaceModificationsModule,
    forwardRef(() => CandidateSearchModule),
    GraphQLExecutionModule,
  ],
  controllers: [AssistantController],
  providers: [
    McpToolCallCacheService,
    McpInProcessToolRunnerService,
    McpAssistantToolExecutorService,
    McpAnthropicMessageProcessorService,
    McpAssistantService,
    AssistantThreadService,
    AutonomousRecruitmentAgentRulesService,
    AssistantThreadTableDataService,
    AssistantIterativeQueryService,
    AssistantChatStreamService,
  ],
  exports: [
    McpAssistantService,
    AutonomousRecruitmentAgentRulesService,
    AssistantThreadService,
  ],
})
export class AssistantModule {}
