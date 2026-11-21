import { Module } from '@nestjs/common';

import { BrightDataSerpService } from './services/bright-data-serp.service';

// Serp depends only on global modules (provider call log, query cache, raw
// fetch archive), so it does not need the rest of BrightDataModule. Keeping it
// in its own module lets ArxWebSearchModule and JudgeModule reach it without
// importing BrightDataModule, which would be a cycle: BrightData → Judge →
// ArxWebSearch → BrightData.
@Module({
  providers: [BrightDataSerpService],
  exports: [BrightDataSerpService],
})
export class SerpModule {}
