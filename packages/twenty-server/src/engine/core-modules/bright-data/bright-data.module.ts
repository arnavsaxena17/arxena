import { Module } from '@nestjs/common';

import { BrightDataSerpService } from './services/bright-data-serp.service';

@Module({
  providers: [BrightDataSerpService],
  exports: [BrightDataSerpService],
})
export class BrightDataModule {}
