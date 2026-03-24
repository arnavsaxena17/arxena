import { Module } from '@nestjs/common';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { TwentyORMModule } from 'src/engine/twenty-orm/twenty-orm.module';
import { TimelineActivityModule } from 'src/modules/timeline/timeline-activity.module';

import { SupportChatController } from './support-chat.controller';
import { ChatwootClientService } from './services/chatwoot-client.service';
import { SupportChatAiService } from './services/support-chat-ai.service';
import { SupportChatConfigService } from './services/support-chat-config.service';
import { SupportChatOrchestratorService } from './services/support-chat-orchestrator.service';
import { SupportChatSyncService } from './services/support-chat-sync.service';

@Module({
  imports: [EnvironmentModule, TwentyORMModule, TimelineActivityModule],
  controllers: [SupportChatController],
  providers: [
    SupportChatConfigService,
    ChatwootClientService,
    SupportChatAiService,
    SupportChatSyncService,
    SupportChatOrchestratorService,
  ],
  exports: [SupportChatConfigService],
})
export class SupportChatModule {}
