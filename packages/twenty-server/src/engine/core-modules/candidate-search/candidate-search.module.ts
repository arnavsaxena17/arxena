import { Module } from '@nestjs/common';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchService } from './services/candidate-search.service';
import { FileUtils } from './utils/file.utils';
import { ParameterResolver } from './utils/parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';

@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule],
  controllers: [CandidateSearchController],
  providers: [
    CandidateSearchService, 
    CandidateSearchPromptService,
    ParameterResolver,
    ParameterSanitizer,
    FileUtils,
  ],
  exports: [CandidateSearchService, CandidateSearchPromptService],
})
export class CandidateSearchModule {}
