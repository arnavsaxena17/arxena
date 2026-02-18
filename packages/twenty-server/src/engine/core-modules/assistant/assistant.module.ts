import { Module } from '@nestjs/common';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { AssistantThreadService } from './assistant-thread.service';
import { AssistantController } from './assistant.controller';
import { McpAssistantService } from './mcp-assistant.service';

@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule, WorkspaceModificationsModule, CandidateSearchModule],
  controllers: [AssistantController],
  providers: [McpAssistantService, AssistantThreadService],
  exports: [McpAssistantService],
})
export class AssistantModule {}
