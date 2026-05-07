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
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { UnipilePoolModule } from '../arx-chat/unipile-pool.module';
import { CandidateSourcingModule } from '../candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { LinkedInSearchModule } from '../linkedin-search/linkedin-search.module';
import { OrgChartModule } from '../org-chart/org-chart.module';
import { OrgChartProfileDataSourceMapperService } from '../org-chart/services/org-chart-profile-data-source-mapper.service';
import { PythonOrgChartService } from '../org-chart/services/python-org-chart.service';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { ApolloSearchController } from './controllers/apollo-search.controller';
import { CandidateSearchPipelineController } from './controllers/candidate-search-pipeline.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { OrgchartApifyBuildProcessor } from './jobs/orgchart-apify-build.processor';
import { OrgchartApolloBuildProcessor } from './jobs/orgchart-apollo-build.processor';
import { OrgchartHarvestBuildProcessor } from './jobs/orgchart-harvest-build.processor';
import { OrgchartLinkedinXrayBuildProcessor } from './jobs/orgchart-linkedin-xray-build.processor';
import { OrgchartMultiSourceBuildProcessor } from './jobs/orgchart-multisource-build.processor';
import { OrgchartUnipileBuildProcessor } from './jobs/orgchart-unipile-build.processor';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { ApolloIoRestService } from './services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from './services/apollo-people-search-transformer.service';
import { AssistantThreadService } from './services/assistant-thread.service';
import { BooltreeHintService } from './services/booltree-hint.service';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { ClassifyMessageService } from './services/classify-message.service';
import { CleanupService } from './services/cleanup.service';
import { CompanyExpanderService } from './services/company-expander.service';
import { JobDescriptionService } from './services/job-description.service';
import { JobTitleExpanderService } from './services/job-title-expander.service';
import { OrgChartIntentService } from './services/org-chart-intent.service';
import { OrgchartLinkedInQueryRouterService } from './services/orgchart-linkedin-query-router.service';
import { OrgChartSearchService } from './services/orgchart-search.service';
import { PythonQueryGenerationService } from './services/python-query-generation.service';
import { QueryConstructorService } from './services/query-constructor.service';
import { RequirementAnalyzerService } from './services/requirement-analyzer.service';
import { SearchIntentRouterService } from './services/search-intent-router.service';
import { SearchResponseBuilderService } from './services/search-response-builder.service';
import { SearchResultsCacheService } from './services/search-results-cache.service';
import { StrategyExecutionService } from './services/strategy-execution.service';
import { TitleTaxonomyRemoteService } from './services/title-taxonomy-remote.service';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from './utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from './utils/parameter-sanitizer.util';
@Module({
  imports: [
    BillingModule,
    EnvironmentModule,
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
  controllers: [
    CandidateSearchController,
    CandidateSearchChatController,
    CandidateSearchPipelineController,
    ApolloSearchController,
  ],
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
    SearchIntentRouterService,
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
    ApolloIoRestService,
    ApolloPeopleSearchTransformerService,
    OrgChartIntentService,
    TitleTaxonomyRemoteService,
    OrgchartLinkedInQueryRouterService,
    OrgChartSearchService,
    OrgchartApifyBuildProcessor,
    OrgchartApolloBuildProcessor,
    OrgchartUnipileBuildProcessor,
    OrgchartLinkedinXrayBuildProcessor,
    OrgchartHarvestBuildProcessor,
    OrgchartMultiSourceBuildProcessor,
    // Executive search enhancement services
    PythonOrgChartService,
    OrgChartProfileDataSourceMapperService,
  ],
  exports: [
    CandidateSearchBaseService,
    CandidateSearchHandlerService,
    OrgChartSearchService,
    ResultValidationService,
    StreamProcessingService,
    ApolloIoRestService,
    ApolloPeopleSearchTransformerService,
    PythonQueryGenerationService,
  ],
})
export class CandidateSearchModule {}
