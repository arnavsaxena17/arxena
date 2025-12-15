import { Module } from '@nestjs/common';

import { SearchModelsController } from './controllers/search-models.controller';
import { SearchModelsService } from './services/search-models.service';

@Module({
  controllers: [SearchModelsController],
  providers: [SearchModelsService],
  exports: [SearchModelsService],
})
export class SearchModelsModule {}




