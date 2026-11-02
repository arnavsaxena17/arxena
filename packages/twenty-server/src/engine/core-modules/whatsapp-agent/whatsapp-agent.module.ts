import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceDomainsModule } from 'src/engine/core-modules/domain/workspace-domains/workspace-domains.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { AiChatModule } from 'src/engine/metadata-modules/ai/ai-chat/ai-chat.module';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';

import { WhatsappAgentService } from './whatsapp-agent.service';

@Module({
  imports: [
    AiChatModule,
    WorkspaceDomainsModule,
    AiModelsModule,
    AiBillingModule,
    TypeOrmModule.forFeature([UserWorkspaceEntity, WorkspaceEntity]),
  ],
  providers: [WhatsappAgentService],
  exports: [WhatsappAgentService],
})
export class WhatsappAgentModule {}
