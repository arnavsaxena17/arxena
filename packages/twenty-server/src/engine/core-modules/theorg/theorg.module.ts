import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { TheOrgController } from 'src/engine/core-modules/theorg/controllers/theorg.controller';
import { TheOrgCompanyEnrichmentJob } from 'src/engine/core-modules/theorg/jobs/process-theorg-company-enrichment.job';
import { TheOrgJobService } from 'src/engine/core-modules/theorg/services/theorg-job.service';
import { TheOrgService } from 'src/engine/core-modules/theorg/services/theorg.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    AuthModule,
    BrightDataModule,
    CacheStorageModule,
    MessageQueueModule,
    WorkspaceCacheStorageModule,
  ],
  controllers: [TheOrgController],
  providers: [TheOrgService, TheOrgJobService, TheOrgCompanyEnrichmentJob],
  exports: [TheOrgService, TheOrgJobService],
})
export class TheOrgModule {}
