import { Module } from '@nestjs/common';

import { ArxWebSearchService } from 'src/domains/discovery/providers/web-evidence/arx-web-search.service';
import { PerplexitySearchService } from 'src/domains/discovery/providers/web-evidence/perplexity-search.service';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';

@Module({
  imports: [BrightDataModule],
  providers: [PerplexitySearchService, ArxWebSearchService],
  exports: [ArxWebSearchService],
})
export class ArxWebSearchModule {}
