import { Module, forwardRef } from '@nestjs/common';

import { ArxWebSearchService } from 'src/engine/core-modules/arx-web-search/arx-web-search.service';
import { PerplexitySearchService } from 'src/engine/core-modules/arx-web-search/perplexity-search.service';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';

@Module({
  imports: [forwardRef(() => BrightDataModule)],
  providers: [PerplexitySearchService, ArxWebSearchService],
  exports: [ArxWebSearchService],
})
export class ArxWebSearchModule {}
