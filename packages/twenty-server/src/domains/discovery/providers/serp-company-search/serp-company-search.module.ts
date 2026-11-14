import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { SerpCompanySearchService } from 'src/domains/discovery/providers/serp-company-search/services/serp-company-search.service';
import { LLMChatModelModule } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.module';

@Module({
  imports: [AuthModule, BrightDataModule, LLMChatModelModule],
  providers: [SerpCompanySearchService],
  exports: [SerpCompanySearchService],
})
export class SerpCompanySearchModule {}
