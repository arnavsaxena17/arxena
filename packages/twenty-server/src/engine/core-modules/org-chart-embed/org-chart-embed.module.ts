import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { OrgChartEmbedController } from './org-chart-embed.controller';
import { OrgChartEmbedService } from './org-chart-embed.service';
import { OrgChartEmbedWebhookService } from './org-chart-embed-webhook.service';

@Module({
  imports: [
    OrgChartModule,
    AuthModule,
    WorkspaceModificationsModule,
    WorkspaceCacheStorageModule,
    WorkspaceCacheModule,
    MessageQueueModule,
  ],
  controllers: [OrgChartEmbedController],
  providers: [OrgChartEmbedService, OrgChartEmbedWebhookService, JwtAuthGuard],
  exports: [OrgChartEmbedService],
})
export class OrgChartEmbedModule {}
