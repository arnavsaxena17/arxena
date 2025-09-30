import { Module } from '@nestjs/common';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchService } from './services/candidate-search.service';

@Module({
  imports: [LinkedInSearchModule],
  controllers: [CandidateSearchController],
  providers: [CandidateSearchService, CandidateSearchPromptService],
  exports: [CandidateSearchService, CandidateSearchPromptService],
})
export class CandidateSearchModule {}
