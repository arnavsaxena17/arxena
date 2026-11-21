import { Module } from '@nestjs/common';

import { ArxWebSearchService } from 'src/engine/core-modules/arx-web-search/arx-web-search.service';
import { PerplexitySearchService } from 'src/engine/core-modules/arx-web-search/perplexity-search.service';
import { SerpModule } from 'src/engine/core-modules/bright-data/serp.module';

@Module({
  imports: [SerpModule],
  providers: [PerplexitySearchService, ArxWebSearchService],
  exports: [ArxWebSearchService],
})
export class ArxWebSearchModule {}
