import { Module } from '@nestjs/common';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { AssistantThreadService } from './assistant-thread.service';
import { AssistantController } from './assistant.controller';
import { McpAssistantService } from './mcp-assistant.service';

@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule, WorkspaceModificationsModule],
  controllers: [AssistantController],
  providers: [McpAssistantService, AssistantThreadService],
  exports: [McpAssistantService],
})
export class AssistantModule {}
