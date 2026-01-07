import { Module } from '@nestjs/common';
import { CandidateSearchChatController } from 'src/engine/core-modules/candidate-search/controllers/candidate-search-chat.controller';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { ResumeReaderService } from 'src/engine/core-modules/candidate-sourcing/services/resume-reader.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchTestController } from './controllers/candidate-search-test.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
// import { CandidateSearchPromptService } from './services/candidate-search-prompt.service';
import { CandidateSearchStreamingService } from './services/candidate-search-streaming.service';
// import { CandidateSearchService } from './services/candidate-search.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { JobDescriptionService } from './services/job-description.service';
import { QuerySimplificationService } from './services/query-simplification.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';
@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule, GraphQLExecutionModule],
  controllers: [CandidateSearchController, CandidateSearchChatController, CandidateSearchTestController],
  providers: [
    CandidateSearchBaseService,
    CandidateSearchStreamingService,
    CandidateSearchHandlerService,
    CandidateSearchTestController,
    // CandidateSearchPromptService,
    JobDescriptionService,
    LinkedinParameterResolver,
    LinkedInSearchService,
    SearchGenerationService,
    ResumeReaderService,  
    ParameterSanitizer,
    FileUtils,
    SearchParametersPrompts,
    QuerySimplificationService,
  ],
  exports: [CandidateSearchBaseService, CandidateSearchStreamingService, CandidateSearchTestController],
})
export class CandidateSearchModule {}
