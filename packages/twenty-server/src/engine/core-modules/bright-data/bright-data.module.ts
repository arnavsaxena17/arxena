import { Module } from '@nestjs/common';

import { BrightDataLinkedinProfileScrapeService } from './services/bright-data-linkedin-profile-scrape.service';
import { BrightDataLinkedinPeopleSearchService } from './services/bright-data-linkedin-people-search.service';
import { BrightDataSerpService } from './services/bright-data-serp.service';

@Module({
  providers: [
    BrightDataSerpService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
  ],
  exports: [
    BrightDataSerpService,
    BrightDataLinkedinPeopleSearchService,
    BrightDataLinkedinProfileScrapeService,
  ],
})
export class BrightDataModule {}
