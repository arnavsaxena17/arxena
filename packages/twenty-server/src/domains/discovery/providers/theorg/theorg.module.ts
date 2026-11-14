import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { TheOrgCompanyEnrichmentJob } from 'src/domains/discovery/providers/theorg/jobs/process-theorg-company-enrichment.job';
import { TheOrgJobService } from 'src/domains/discovery/providers/theorg/services/theorg-job.service';
import { TheOrgService } from 'src/domains/discovery/providers/theorg/services/theorg.service';

@Module({
  imports: [
    AuthModule,
    BrightDataModule,
    CacheStorageModule,
    MessageQueueModule,
  ],
  providers: [TheOrgService, TheOrgJobService, TheOrgCompanyEnrichmentJob],
  exports: [TheOrgService, TheOrgJobService],
})
export class TheOrgModule {}
