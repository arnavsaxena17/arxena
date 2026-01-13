import { Module } from '@nestjs/common';
import { CandidateSearchChatController } from 'src/engine/core-modules/candidate-search/controllers/candidate-search-chat.controller';
import { CandidateScoringService } from 'src/engine/core-modules/candidate-search/services/candidate-scoring.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { QueryUnderstandingService } from 'src/engine/core-modules/candidate-search/services/query-understanding.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import { SearchExecutionService } from 'src/engine/core-modules/candidate-search/services/search-execution.service';
import { SearchGenerationService } from 'src/engine/core-modules/candidate-search/services/search-generation.service';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { SearchStrategyService } from 'src/engine/core-modules/candidate-search/services/search-strategy.service';
import { StreamProcessingService } from 'src/engine/core-modules/candidate-search/services/stream-processing.service';
import { ResumeReaderService } from 'src/engine/core-modules/candidate-sourcing/services/resume-reader.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchTestController } from './controllers/candidate-search-test.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { RecruitingKnowledgePrompts } from './prompts/recruiting-knowledge-prompts';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { DiscoveryService } from './services/discovery.service';
import { JobDescriptionService } from './services/job-description.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { QuerySimplificationService } from './services/query-simplification.service';
import { StrategyEvolutionService } from './services/strategy-evolution.service';
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
    QueryUnderstandingService,
    SearchParameterGenerationService,
    SearchExecutionService,
    SearchStrategyService,
    CandidateScoringService,
    ResultValidationService,
    JobDescriptionService,
    LinkedinParameterResolver,
    LinkedInSearchService,
    SearchGenerationService,
    ResumeReaderService,  
    ParameterSanitizer,
    FileUtils,
    SearchParametersPrompts,
    QuerySimplificationService,
    DiscoveryService,
    // Executive search enhancement services
    KnowledgeBaseService,
    StrategyEvolutionService,
    RecruitingKnowledgePrompts,
  ],
  exports: [CandidateSearchBaseService, CandidateSearchTestController],
})
export class CandidateSearchModule {}
