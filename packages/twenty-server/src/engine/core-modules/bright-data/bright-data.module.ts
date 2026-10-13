import { Module, forwardRef } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { OutreachListController } from 'src/engine/core-modules/bright-data/controllers/outreach-list.controller';
import { BrightDataBusinessSearchController } from 'src/engine/core-modules/bright-data/controllers/bright-data-business-search.controller';
import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { BrightDataBillingService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-billing.service';
import { BrightDataLudicrousDatasetStoreService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-dataset-store.service';
import { BrightDataLudicrousExecutorService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-executor.service';
import { BrightDataLudicrousPlannerService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-planner.service';
import { BrightDataLudicrousPlanStoreService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-plan-store.service';
import { BrightDataLudicrousRelevanceJudgeService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-relevance-judge.service';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { BrightDataGoogleMapsPlacesService } from './services/bright-data-google-maps-places.service';
import { BrightDataLinkedinProfileScrapeService } from './services/bright-data-linkedin-profile-scrape.service';
import { BrightDataLinkedinPeopleSearchService } from './services/bright-data-linkedin-people-search.service';
import { BrightDataResidentialProxyService } from './services/bright-data-residential-proxy.service';
import { BrightDataSerpService } from './services/bright-data-serp.service';
import { BrightDataUnlockerService } from './services/bright-data-unlocker.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    BillingModule,
    AiBillingModule,
    AiModelsModule,
    WorkspaceCacheModule,
    // AiFilterEngineService (relevance judge) lives on CandidateSourcing.
    // CandidateSourcing → OutreachCommand → OrgChart → TheOfficialBoard, and
    // ToolModule → OrgChart, both read BrightDataModule while this file is
    // still initializing. Lazy require waits until the class exists.
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../candidate-sourcing/candidate-sourcing.module')
        .CandidateSourcingModule;
    }),
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../tool/tool.module').ToolModule;
    }),
  ],
  controllers: [BrightDataBusinessSearchController, OutreachListController],
  providers: [
    JwtAuthGuard,
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
    BrightDataBillingService,
    BrightDataLudicrousPlanStoreService,
    BrightDataLudicrousDatasetStoreService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataLudicrousPlannerService,
    BrightDataLudicrousExecutorService,
    BrightDataLudicrousSearchService,
  ],
  exports: [
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
    BrightDataBillingService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataLudicrousSearchService,
  ],
})
export class BrightDataModule {}
