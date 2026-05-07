import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { SerpCompanySearchController } from 'src/engine/core-modules/linkedin-company-search/controllers/linkedin-company-search.controller';
import { SerpCompanySearchService } from 'src/engine/core-modules/linkedin-company-search/services/linkedin-company-search.service';
import { LLMChatModelModule } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    AuthModule,
    BrightDataModule,
    WorkspaceCacheStorageModule,
    LLMChatModelModule,
  ],
  controllers: [SerpCompanySearchController],
  providers: [SerpCompanySearchService],
  exports: [SerpCompanySearchService],
})
export class SerpCompanySearchModule {}
