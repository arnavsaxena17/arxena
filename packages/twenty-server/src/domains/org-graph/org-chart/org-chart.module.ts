import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountRateLimitModule } from 'src/engine/core-modules/account-rate-limit/account-rate-limit.module';
import { ApifyModule } from 'src/domains/discovery/providers/apify/apify.module';
import { ApiKeyModule } from 'src/engine/core-modules/api-key/api-key.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { OrgChartBrightDataController } from 'src/domains/org-graph/org-chart/controllers/org-chart-bright-data.controller';
import { OrgChartBrightDataPeopleService } from 'src/domains/org-graph/org-chart/services/org-chart-bright-data-people.service';
import { CandidateSourcingModule } from 'src/domains/ingestion/candidate-sourcing/candidate-sourcing.module';
import { ContactEnrichmentModule } from 'src/domains/discovery/providers/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/domains/discovery/transport/linkedin-search/linkedin-search.module';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { TheOfficialBoardModule } from 'src/domains/discovery/providers/theofficialboard/theofficialboard.module';
import { BuiltWithModule } from 'src/domains/discovery/providers/builtwith/builtwith.module';
import { TheOrgModule } from 'src/domains/discovery/providers/theorg/theorg.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { LinkedinXrayModule } from 'src/modules/linkedin-xray/linkedin-xray.module';

import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-unipile.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';

import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { OrgChartClientIpModule } from 'src/domains/org-graph/org-chart/org-chart-client-ip.module';

import { LinkedInStrategySource } from 'src/domains/org-graph/org-chart/build/services/linkedin-strategy-source.service';
import { OrgChartChartBuildService } from 'src/domains/org-graph/org-chart/build/services/orgchart-chart-build.service';
import { OrgChartLinkedInSearchService } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-search.service';
import { OrgchartLinkedInQueryRouterService } from 'src/domains/org-graph/org-chart/build/services/orgchart-linkedin-query-router.service';
import { OrgchartUnipileShardPlannerService } from 'src/domains/org-graph/org-chart/build/services/orgchart-unipile-shard-planner.service';
import { OrgchartApifyBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-apify-build.processor';
import { OrgchartApolloBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-apollo-build.processor';
import { OrgchartHarvestBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-harvest-build.processor';
import { OrgchartLinkedinXrayBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-linkedin-xray-build.processor';
import { OrgchartMultiSourceBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-multisource-build.processor';
import { OrgchartSuperImposeBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-super-impose-build.processor';
import { OrgchartUnipileBuildProcessor } from 'src/domains/org-graph/org-chart/build/jobs/orgchart-unipile-build.processor';
import { DiscoveryQueryModule } from 'src/domains/discovery/query/query.module';
import { ApolloProviderModule } from 'src/domains/discovery/providers/apollo/apollo.module';
import { EvaluationModule } from 'src/domains/evaluation/evaluation.module';
import { TitleTaxonomyModule } from 'src/domains/discovery/query/title-taxonomy/title-taxonomy.module';
import { AiBillingModule } from 'src/engine/metadata-modules/ai/ai-billing/ai-billing.module';

import { ElasticsearchSearchController } from './controllers/elasticsearch-search.controller';
import { HarvestSearchController } from './controllers/harvest-search.controller';
import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompaniesEsService } from './services/companies-es.service';
import { CompanyNameResolverService } from './services/company-name-resolver.service';
import { CompanyLogoService } from './services/company-logo.service';
import { ContactOutPeopleSearchService } from './services/contactout-people-search.service';
import { ContactOutPersonOrgMovementService } from './services/contactout-person-org-movement.service';
import { CoreSignalPersonOrgMovementService } from './services/coresignal-person-org-movement.service';
import { HarvestLinkedinTransformerService } from './services/harvest-linkedin-transformer.service';
import { HarvestLinkedinService } from './services/harvest-linkedin.service';
import { ImageProxyService } from './services/image-proxy.service';
import { OrgChartEsService } from './services/org-chart-es.service';
import { OrgChartLinkedInBuildService } from './services/org-chart-linkedin-build.service';
import { OrgChartRecordWorkspaceService } from './services/org-chart-record-workspace.service';
import { OrgChartSuperImposeAutocompleteService } from './services/org-chart-super-impose-autocomplete.service';
import { OrgChartSuperImposeService } from './services/org-chart-super-impose.service';
import { OrgChartTheOrgEnrichmentService } from './services/org-chart-theorg-enrichment.service';
import { OrgChartIntentService } from './services/org-chart-intent.service';
import { StreamProcessingService } from 'src/engine/core-modules/llm-chat-model/services/stream-processing.service';
import { OrgChartService } from './services/org-chart.service';
import { OrgChartCacheService } from './services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from './services/orgchart-cancel-registry.service';
import { OrgChartIncrementalBuildCacheService } from './services/orgchart-incremental-build-cache.service';
import { OrgChartPublishedAdminService } from './services/org-chart-published-admin.service';
import { OrgChartPublishedSlugService } from './services/org-chart-published-slug.service';
import { OrgChartCompanyNewsService } from './services/org-chart-company-news.service';
import { OrgChartCompanyTechnologyService } from './services/org-chart-company-technology.service';
import { OrgChartGrantAdminService } from './services/org-chart-grant-admin.service';
import { OrgChartCatalogS3Service } from './services/org-chart-catalog-s3.service';
import { OrgChartS3Service } from './services/orgchart-s3.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PdlPersonOrgMovementService } from './services/pdl-person-org-movement.service';
import { PeopleEsService } from './services/people-es.service';
import { PersonOrgMovementService } from './services/person-org-movement.service';
import { PythonOrgChartService } from './services/python-org-chart.service';
import { OrgChartProfileDataSourceMapperService } from './services/org-chart-profile-data-source-mapper.service';
import { SuperImposeQueryBuilderService } from './services/super-impose-query-builder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    CandidateAvatarModule,
    OrgChartClientIpModule,
    ApifyModule,
    ApiKeyModule,
    AuthModule,
    BillingModule,
    BrightDataModule,
    forwardRef(() => CandidateSourcingModule),
    ContactEnrichmentModule,
    EnvironmentModule,
    RedisClientModule,
    GraphQLExecutionModule,
    AccountRateLimitModule,
    LinkedInSearchModule,
    LinkedinXrayModule,
    TheOrgModule,
    TheOfficialBoardModule,
    BuiltWithModule,
    WorkspaceModificationsModule,
    WorkspaceCacheStorageModule,
    DiscoveryQueryModule,
    ApolloProviderModule,
    EvaluationModule,
    TitleTaxonomyModule,
    AiBillingModule,
    UnipilePoolModule,
  ],
  controllers: [
    OrgChartController,
    ElasticsearchSearchController,
    OrgChartBrightDataController,
    HarvestSearchController,
  ],
  providers: [
    OrgChartIntentService,
    StreamProcessingService,
    OrgChartChartBuildService,
    OrgChartLinkedInSearchService,
    LinkedInStrategySource,
    OrgchartLinkedInQueryRouterService,
    OrgchartUnipileShardPlannerService,
    OrgchartApifyBuildProcessor,
    OrgchartApolloBuildProcessor,
    OrgchartHarvestBuildProcessor,
    OrgchartLinkedinXrayBuildProcessor,
    OrgchartMultiSourceBuildProcessor,
    OrgchartSuperImposeBuildProcessor,
    OrgchartUnipileBuildProcessor,
    OrgChartBrightDataPeopleService,
    UnipileCompanyService,
    WorkspaceMemberUnipileService,
    JwtAuthGuard,
    OrgChartService,
    OrgChartLinkedInBuildService,
    HarvestLinkedinService,
    HarvestLinkedinTransformerService,
    OrgChartRecordWorkspaceService,
    OrgChartGrantAdminService,
    OrgChartTheOrgEnrichmentService,
    ArxenaBackendService,
    OrgChartEsService,
    CompaniesEsService,
    CompanyNameResolverService,
    PeopleEsService,
    PdlAutocompleteService,
    PdlPersonOrgMovementService,
    CoreSignalPersonOrgMovementService,
    ContactOutPeopleSearchService,
    ContactOutPersonOrgMovementService,
    PersonOrgMovementService,
    CompanyLogoService,
    ImageProxyService,
    PythonOrgChartService,
    OrgChartProfileDataSourceMapperService,
    OrgChartS3Service,
    OrgChartCatalogS3Service,
    OrgChartCompanyNewsService,
    OrgChartCompanyTechnologyService,
    OrgChartCacheService,
    OrgchartCancelRegistryService,
    OrgChartIncrementalBuildCacheService,
    SuperImposeQueryBuilderService,
    OrgChartSuperImposeService,
    OrgChartSuperImposeAutocompleteService,
    OrgChartPublishedAdminService,
    OrgChartPublishedSlugService,
  ],
  exports: [
    OrgChartIntentService,
    OrgchartLinkedInQueryRouterService,
    StreamProcessingService,
    OrgChartChartBuildService,
    OrgChartLinkedInSearchService,
    LinkedInStrategySource,
    OrgChartService,
    OrgChartS3Service,
    OrgChartCompanyNewsService,
    OrgChartPublishedAdminService,
    OrgChartPublishedSlugService,
    OrgChartGrantAdminService,
    OrgChartRecordWorkspaceService,
    OrgChartCacheService,
    OrgchartCancelRegistryService,
    OrgChartIncrementalBuildCacheService,
    OrgChartTheOrgEnrichmentService,
    OrgChartLinkedInBuildService,
    PdlPersonOrgMovementService,
    CoreSignalPersonOrgMovementService,
    ContactOutPeopleSearchService,
    ContactOutPersonOrgMovementService,
    PersonOrgMovementService,
    OrgChartSuperImposeAutocompleteService,
    CompaniesEsService,
    CompanyNameResolverService,
    PeopleEsService,
    OrgChartEsService,
    ImageProxyService,
    HarvestLinkedinService,
    HarvestLinkedinTransformerService,
    OrgChartSuperImposeService,
    UnipileCompanyService,
  ],
})
export class OrgChartModule {}
