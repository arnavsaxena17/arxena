import { forwardRef, Module } from '@nestjs/common';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { CandidateSearchChatController } from 'src/domains/planning/candidate-search/controllers/candidate-search-chat.controller';
import { LinkedinSearchExecutionBase } from 'src/domains/discovery/query/services/linkedin-search-execution.base';
import { ResultValidationService } from 'src/domains/evaluation/result-validation.service';
import { SearchParameterGenerationService } from 'src/domains/planning/candidate-search/services/search-parameter-generation.service';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';
import { CandidateDataService } from 'src/domains/ingestion/candidate-sourcing/services/candidate-data.service';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { LinkedInHtmlParserService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-html-parser.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/domains/org-graph/org-chart/org-chart.module';
import { PythonOrgChartService } from 'src/domains/org-graph/org-chart/services/python-org-chart.service';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { ApolloSearchController } from './controllers/apollo-search.controller';
import { CandidateSearchPipelineController } from './controllers/candidate-search-pipeline.controller';
import { CandidateSearchController } from './controllers/candidate-search.controller';
import { SearchParametersPrompts } from './prompts/search-parameters-prompts';
import { ApolloIoRestService } from 'src/domains/discovery/providers/apollo/services/apollo-io-rest.service';
import { ApolloPeopleSearchTransformerService } from 'src/domains/discovery/providers/apollo/services/apollo-people-search-transformer.service';
import { CandidateSearchAssistantThreadAdapter } from './services/candidate-search-assistant-thread.adapter';
import { CandidateSearchHandlerService } from './services/candidate-search-handler.service';
import { ClassifyMessageService } from './services/classify-message.service';
import { CleanupService } from './services/cleanup.service';
import { CompanyExpanderService } from './services/company-expander.service';
import { JobDescriptionService } from './services/job-description.service';
import { JobTitleExpanderService } from './services/job-title-expander.service';
import { OrgChartIntentService } from 'src/domains/org-graph/org-chart/services/org-chart-intent.service';
import { RequirementAnalyzerService } from './services/requirement-analyzer.service';
import { SearchIntentRouterService } from './services/search-intent-router.service';
import { SearchResponseBuilderService } from './services/search-response-builder.service';
import { SearchResultsCacheService } from './services/search-results-cache.service';
import { StrategyExecutionService } from './services/strategy-execution.service';
import { DiscoveryQueryModule } from 'src/domains/discovery/query/query.module';
import { ApolloProviderModule } from 'src/domains/discovery/providers/apollo/apollo.module';
import { EvaluationModule } from 'src/domains/evaluation/evaluation.module';
import { TitleTaxonomyModule } from 'src/domains/discovery/query/title-taxonomy/title-taxonomy.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';
import { AiModelsModule } from 'src/engine/metadata-modules/ai/ai-models/ai-models.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { FileUtils } from './utils/file.utils';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';
import { ParameterSanitizer } from 'src/domains/discovery/query/utils/parameter-sanitizer.util';
@Module({
  imports: [
    TitleTaxonomyModule,
    DiscoveryQueryModule,
    ApolloProviderModule,
    EvaluationModule,
    BillingModule,
    CandidateAvatarModule,
    EnvironmentModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    WorkspaceModificationsModule,
    WorkspaceCacheStorageModule,
    AiBillingModule,
    AiModelsModule,
    forwardRef(() => CandidateSourcingModule),
    GraphQLExecutionModule,
    forwardRef(() => OrgChartModule),
    forwardRef(() => {
      // AssistantModule imports CandidateSearchModule; lazy require keeps that
      // cycle out of the module graph. Relative path, not 'src/…': only SWC's
      // alias mapping resolves those at compile time, and this require stays
      // literal in the emitted JS.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../../../engine/core-modules/assistant/assistant.module')
        .AssistantModule;
    }),
  ],
  controllers: [
    CandidateSearchController,
    CandidateSearchChatController,
    CandidateSearchPipelineController,
    ApolloSearchController,
  ],
  providers: [
    CandidateSearchHandlerService,
    StreamProcessingService,
    SearchParameterGenerationService,
    CandidateDataService,
    LinkedInHtmlParserService,
    JobDescriptionService,
    // SearchGenerationService,
    FileUtils,
    SearchParametersPrompts,
    // QuerySimplificationService,
    RequirementAnalyzerService,
    SearchIntentRouterService,
    JobTitleExpanderService,
    CandidateSearchAssistantThreadAdapter,
    CompanyExpanderService,
    CleanupService,
    ClassifyMessageService,
    SearchResponseBuilderService,
    StrategyExecutionService,
    SearchResultsCacheService,
    // Executive search enhancement services
    PythonOrgChartService,
  ],
  exports: [
    CandidateSearchHandlerService,
    StreamProcessingService,
    TitleTaxonomyModule,
    DiscoveryQueryModule,
    ApolloProviderModule,
    EvaluationModule,
  ],
})
export class CandidateSearchModule {}
