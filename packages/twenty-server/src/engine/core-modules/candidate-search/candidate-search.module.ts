import { Module } from '@nestjs/common';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { SearchPlanGenerationController } from './controllers/search-plan-generation.controller';
import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchService } from './services/candidate-search.service';
import { SearchPlanGenerationService } from './services/search-plan-generation.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';

@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule, GraphQLExecutionModule],
  controllers: [CandidateSearchController, SearchPlanGenerationController],
  providers: [
    CandidateSearchService, 
    CandidateSearchPromptService,
    LinkedinParameterResolver,
    ParameterSanitizer,
    FileUtils,
    SearchPlanGenerationService,
  ],
  exports: [CandidateSearchService, CandidateSearchPromptService, SearchPlanGenerationService],
})
export class CandidateSearchModule {}
