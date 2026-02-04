import { Module } from '@nestjs/common';
import { CandidateSearchChatController } from 'src/engine/core-modules/candidate-search/controllers/candidate-search-chat.controller';
import { CandidateScoringService } from 'src/engine/core-modules/candidate-search/services/candidate-scoring.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import { SearchExecutionService } from 'src/engine/core-modules/candidate-search/services/search-execution.service';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { StreamProcessingService } from 'src/engine/core-modules/candidate-search/services/stream-processing.service';
import { ResumeReaderService } from 'src/engine/core-modules/candidate-sourcing/services/resume-reader.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchTestController } from './controllers/candidate-search-test.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { JobDescriptionService } from './services/job-description.service';
import { RequirementAnalyzerService } from './services/requirement-analyzer.service';
import { JobTitleExpanderService } from './services/job-title-expander.service';
import { CompanyExpanderService } from './services/company-expander.service';
import { QueryConstructorService } from './services/query-constructor.service';
// import { QuerySimplificationService } from './services/query-simplification.service';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';
@Module({
  imports: [LinkedInSearchModule, WorkspaceModificationsModule, CandidateSourcingModule, GraphQLExecutionModule],
  controllers: [CandidateSearchController, CandidateSearchChatController, CandidateSearchTestController],
  providers: [
    CandidateSearchBaseService,
    CandidateSearchHandlerService,
    CandidateSearchTestController,
    StreamProcessingService,
    SearchParameterGenerationService,
    SearchExecutionService,
    CandidateScoringService,
    LinkedInHtmlParserService,
    ResultValidationService,
    JobDescriptionService,
    LinkedinParameterResolver,
    LinkedInSearchService,
    SearchGenerationService,
    ResumeReaderService,  
    ParameterSanitizer,
    FileUtils,
    SearchParametersPrompts,
    // QuerySimplificationService,
    RequirementAnalyzerService,
    JobTitleExpanderService,
    CompanyExpanderService,
    QueryConstructorService,
    // Executive search enhancement services
  ],
  exports: [CandidateSearchBaseService, CandidateSearchTestController],
})
export class CandidateSearchModule {}
