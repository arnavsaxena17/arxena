import { Module } from '@nestjs/common';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchService } from './services/candidate-search.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';

@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule, GraphQLExecutionModule],
  controllers: [CandidateSearchController],
  providers: [
    CandidateSearchService, 
    CandidateSearchPromptService,
    LinkedinParameterResolver,
    LinkedInSearchService,
    SearchGenerationService,
    ParameterSanitizer,
    FileUtils,
  ],
  exports: [CandidateSearchService, CandidateSearchPromptService],
})
export class CandidateSearchModule {}
