import { Module } from '@nestjs/common';

import { BrightDataLinkedinProfileScrapeService } from './services/bright-data-linkedin-profile-scrape.service';
import { BrightDataLinkedinPeopleSearchService } from './services/bright-data-linkedin-people-search.service';
import { BrightDataResidentialProxyService } from './services/bright-data-residential-proxy.service';
import { BrightDataSerpService } from './services/bright-data-serp.service';
import { BrightDataUnlockerService } from './services/bright-data-unlocker.service';

@Module({
  providers: [
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
  ],
  exports: [
    BrightDataResidentialProxyService,
    BrightDataSerpService,
    BrightDataUnlockerService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
  ],
})
export class BrightDataModule {}
