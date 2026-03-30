import { forwardRef, Module } from '@nestjs/common';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { CandidateSearchChatController } from 'src/engine/core-modules/candidate-search/controllers/candidate-search-chat.controller';
import { CandidateScoringService } from 'src/engine/core-modules/candidate-search/services/candidate-scoring.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { ResultValidationService } from 'src/engine/core-modules/candidate-search/services/result-validation.service';
import { SearchExecutionService } from 'src/engine/core-modules/candidate-search/services/search-execution.service';
import { SearchParameterGenerationService } from 'src/engine/core-modules/candidate-search/services/search-parameter-generation.service';
import { StreamProcessingService } from 'src/engine/core-modules/candidate-search/services/stream-processing.service';
import { CandidateDataService } from 'src/engine/core-modules/candidate-sourcing/services/candidate-data.service';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { UnipilePoolModule } from '../arx-chat/unipile-pool.module';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { OrgChartModule } from '../org-chart/org-chart.module';
import { PythonOrgChartService } from '../org-chart/services/python-org-chart.service';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { CandidateSearchPipelineController } from './controllers/candidate-search-pipeline.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { OrgchartApifyBuildProcessor } from './jobs/orgchart-apify-build.processor';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { AssistantThreadService } from './services/assistant-thread.service';
import { BooltreeHintService } from './services/booltree-hint.service';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { ClassifyMessageService } from './services/classify-message.service';
import { CleanupService } from './services/cleanup.service';
import { CompanyExpanderService } from './services/company-expander.service';
import { JobDescriptionService } from './services/job-description.service';
import { JobTitleExpanderService } from './services/job-title-expander.service';
import { OrgChartCacheService } from './services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from './services/orgchart-cancel-registry.service';
import { OrgChartSearchService } from './services/orgchart-search.service';
import { PythonQueryGenerationService } from './services/python-query-generation.service';
import { QueryConstructorService } from './services/query-constructor.service';
import { RequirementAnalyzerService } from './services/requirement-analyzer.service';
import { SearchResponseBuilderService } from './services/search-response-builder.service';
import { SearchResultsCacheService } from './services/search-results-cache.service';
import { StrategyExecutionService } from './services/strategy-execution.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';
@Module({
  imports: [
    BillingModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    WorkspaceModificationsModule,
    CandidateSourcingModule,
    GraphQLExecutionModule,
    forwardRef(() => OrgChartModule),
    forwardRef(() => {
      // Lazy require avoids circular import: AssistantModule imports CandidateSearchModule.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../assistant/assistant.module').AssistantModule;
    }),
  ],
  controllers: [CandidateSearchController, CandidateSearchChatController, CandidateSearchPipelineController],
  providers: [
    CandidateSearchBaseService,
    CandidateSearchHandlerService,
    StreamProcessingService,
    SearchParameterGenerationService,
    CandidateDataService,
    SearchExecutionService,
    CandidateScoringService,
    LinkedinQueryGenerationService,
    LinkedInHtmlParserService,
    ResultValidationService,
    JobDescriptionService,
    LinkedinParameterResolver,
    // SearchGenerationService,
    ParameterSanitizer,
    FileUtils,
    SearchParametersPrompts,
    // QuerySimplificationService,
    RequirementAnalyzerService,
    JobTitleExpanderService,
    AssistantThreadService,
    PythonQueryGenerationService,
    CompanyExpanderService,
    BooltreeHintService,
    QueryConstructorService,
    CleanupService,
    ClassifyMessageService,
    SearchResponseBuilderService,
    StrategyExecutionService,
    SearchResultsCacheService,
    OrgChartCacheService,
    OrgChartSearchService,
    OrgchartCancelRegistryService,
    OrgchartApifyBuildProcessor,
    // Executive search enhancement services
    PythonOrgChartService,
  ],
  exports: [
    CandidateSearchBaseService,
    CandidateSearchHandlerService,
    ResultValidationService,
    StreamProcessingService,
    OrgchartCancelRegistryService,
  ],
})
export class CandidateSearchModule {}
