import { Module, forwardRef } from '@nestjs/common';

import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-billing.service';
import { BrightDataLudicrousExecutorService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-executor.service';
import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-planner.service';
import { BrightDataLudicrousPlanStoreService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-plan-store.service';
import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-relevance-judge.service';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data-ludicrous/services/bright-data-ludicrous-search.service';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';

@Module({
  imports: [
    forwardRef(() => BrightDataModule),
    BillingModule,
    AiBillingModule,
    AiModelsModule,
    WorkspaceCacheModule,
    // Provides AiFilterEngineService, the Jev judge used for relevance scoring
    forwardRef(() => CandidateSourcingModule),
  ],
  providers: [
    BrightDataBillingService,
    BrightDataLudicrousPlanStoreService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataLudicrousPlannerService,
    BrightDataLudicrousExecutorService,
    BrightDataLudicrousSearchService,
  ],
  exports: [
    BrightDataBillingService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataLudicrousSearchService,
  ],
})
export class BrightDataLudicrousModule {}
