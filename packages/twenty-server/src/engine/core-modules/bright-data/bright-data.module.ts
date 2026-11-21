import { BrightDataPersonFitFilterService } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
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
import { JudgeModule } from 'src/engine/core-modules/judge/judge.module';
import { SerpModule } from 'src/engine/core-modules/bright-data/serp.module';
import { TitleTaxonomyModule } from 'src/engine/core-modules/title-taxonomy/title-taxonomy.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { BrightDataGoogleMapsPlacesService } from './services/bright-data-google-maps-places.service';
import { BrightDataLinkedinProfileScrapeService } from './services/bright-data-linkedin-profile-scrape.service';
import { BrightDataLinkedinPeopleSearchService } from './services/bright-data-linkedin-people-search.service';
import { BrightDataResidentialProxyService } from './services/bright-data-residential-proxy.service';
import { BrightDataUnlockerService } from './services/bright-data-unlocker.service';

@Module({
  imports: [
    TitleTaxonomyModule,
    AuthModule,
    WorkspaceCacheStorageModule,
    BillingModule,
    AiBillingModule,
    AiModelsModule,
    WorkspaceCacheModule,
    SerpModule,
    JudgeModule,
  ],
  providers: [
    JwtAuthGuard,
    BrightDataResidentialProxyService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
    BrightDataBillingService,
    BrightDataLudicrousPlanStoreService,
    BrightDataLudicrousDatasetStoreService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataPersonFitFilterService,
    BrightDataLudicrousPlannerService,
    BrightDataLudicrousExecutorService,
    BrightDataLudicrousSearchService,
  ],
  exports: [
    SerpModule,
    BrightDataResidentialProxyService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
    BrightDataGoogleMapsPlacesService,
    BrightDataBusinessSearchService,
    BrightDataBillingService,
    BrightDataLudicrousRelevanceJudgeService,
    BrightDataPersonFitFilterService,
    BrightDataLudicrousSearchService,
  ],
})
export class BrightDataModule {}
