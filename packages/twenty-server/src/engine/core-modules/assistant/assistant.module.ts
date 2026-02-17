import { Module } from '@nestjs/common';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { AssistantController } from './assistant.controller';
import { McpAssistantService } from './mcp-assistant.service';

@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule],
  controllers: [AssistantController],
  providers: [McpAssistantService],
  exports: [McpAssistantService],
})
export class AssistantModule {}
