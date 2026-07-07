import { Module, forwardRef } from '@nestjs/common';

import { ApifyModule } from 'src/engine/core-modules/apify/apify.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { RedisClientModule } from 'src/engine/core-modules/redis-client/redis-client.module';
import { TheOfficialBoardModule } from 'src/engine/core-modules/theofficialboard/theofficialboard.module';
import { TheOrgModule } from 'src/engine/core-modules/theorg/theorg.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { LinkedinXrayModule } from 'src/modules/linkedin-xray/linkedin-xray.module';

import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';

import { CandidateAvatarModule } from 'src/engine/core-modules/candidate-avatar/candidate-avatar.module';
import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';

import { ElasticsearchSearchController } from './controllers/elasticsearch-search.controller';
import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompaniesEsService } from './services/companies-es.service';
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
import { OrgChartService } from './services/org-chart.service';
import { OrgChartCacheService } from './services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from './services/orgchart-cancel-registry.service';
import { OrgChartIncrementalBuildCacheService } from './services/orgchart-incremental-build-cache.service';
import { OrgChartS3Service } from './services/orgchart-s3.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PdlPersonOrgMovementService } from './services/pdl-person-org-movement.service';
import { PeopleEsService } from './services/people-es.service';
import { PersonOrgMovementService } from './services/person-org-movement.service';
import { PythonOrgChartService } from './services/python-org-chart.service';
import { SuperImposeQueryBuilderService } from './services/super-impose-query-builder.service';

@Module({
  imports: [
    CandidateAvatarModule,
    OrgChartClientIpModule,
    ApifyModule,
    AuthModule,
    BillingModule,
    BrightDataModule,
    CandidateSourcingModule,
    ContactEnrichmentModule,
    EnvironmentModule,
    RedisClientModule,
    GraphQLExecutionModule,
    LinkedInSearchModule,
    LinkedinXrayModule,
    TheOrgModule,
    TheOfficialBoardModule,
    WorkspaceModificationsModule,
    WorkspaceCacheStorageModule,
    forwardRef(() => CandidateSearchModule),
    UnipilePoolModule,
  ],
  controllers: [OrgChartController, ElasticsearchSearchController],
  providers: [
    UnipileCompanyService,
    WorkspaceMemberProfileUnipileService,
    JwtAuthGuard,
    OrgChartService,
    OrgChartLinkedInBuildService,
    HarvestLinkedinService,
    HarvestLinkedinTransformerService,
    OrgChartRecordWorkspaceService,
    OrgChartTheOrgEnrichmentService,
    ArxenaBackendService,
    OrgChartEsService,
    CompaniesEsService,
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
    OrgChartS3Service,
    OrgChartCacheService,
    OrgchartCancelRegistryService,
    OrgChartIncrementalBuildCacheService,
    SuperImposeQueryBuilderService,
    OrgChartSuperImposeService,
    OrgChartSuperImposeAutocompleteService,
  ],
  exports: [
    OrgChartService,
    OrgChartS3Service,
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
    PeopleEsService,
    OrgChartEsService,
    ImageProxyService,
  ],
})
export class OrgChartModule {}
