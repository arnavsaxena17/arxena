import { Module } from '@nestjs/common';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchService } from './services/candidate-search.service';

@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule],
  controllers: [CandidateSearchController],
  providers: [CandidateSearchService, CandidateSearchPromptService],
  exports: [CandidateSearchService, CandidateSearchPromptService],
})
export class CandidateSearchModule {}
