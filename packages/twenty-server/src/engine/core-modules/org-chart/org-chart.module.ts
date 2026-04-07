import { Module, forwardRef } from '@nestjs/common';

import { ApifyModule } from 'src/engine/core-modules/apify/apify.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { TheOrgModule } from 'src/engine/core-modules/theorg/theorg.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { LinkedinXrayModule } from 'src/modules/linkedin-xray/linkedin-xray.module';

import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';

import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';

import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompanyLogoService } from './services/company-logo.service';
import { ContactOutPersonOrgMovementService } from './services/contactout-person-org-movement.service';
import { CoreSignalPersonOrgMovementService } from './services/coresignal-person-org-movement.service';
import { ImageProxyService } from './services/image-proxy.service';
import { OrgChartEsService } from './services/org-chart-es.service';
import { OrgChartLinkedInBuildService } from './services/org-chart-linkedin-build.service';
import { OrgChartTheOrgEnrichmentService } from './services/org-chart-theorg-enrichment.service';
import { OrgChartService } from './services/org-chart.service';
import { OrgChartCacheService } from './services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from './services/orgchart-cancel-registry.service';
import { OrgChartS3Service } from './services/orgchart-s3.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PdlPersonOrgMovementService } from './services/pdl-person-org-movement.service';
import { PeopleEsService } from './services/people-es.service';
import { PersonOrgMovementService } from './services/person-org-movement.service';
import { PythonOrgChartService } from './services/python-org-chart.service';

@Module({
  imports: [
    OrgChartClientIpModule,
    ApifyModule,
    BillingModule,
    BrightDataModule,
    CandidateSourcingModule,
    ContactEnrichmentModule,
    EnvironmentModule,
    GraphQLExecutionModule,
    LinkedInSearchModule,
    LinkedinXrayModule,
    TheOrgModule,
    WorkspaceModificationsModule,
    forwardRef(() => CandidateSearchModule),
  ],
  controllers: [OrgChartController],
  providers: [
    UnipileCompanyService,
    WorkspaceMemberProfileUnipileService,
    OrgChartService,
    OrgChartLinkedInBuildService,
    OrgChartTheOrgEnrichmentService,
    ArxenaBackendService,
    OrgChartEsService,
    PeopleEsService,
    PdlAutocompleteService,
    PdlPersonOrgMovementService,
    CoreSignalPersonOrgMovementService,
    ContactOutPersonOrgMovementService,
    PersonOrgMovementService,
    CompanyLogoService,
    ImageProxyService,
    PythonOrgChartService,
    OrgChartS3Service,
    OrgChartCacheService,
    OrgchartCancelRegistryService,
  ],
  exports: [
    OrgChartService,
    OrgChartS3Service,
    OrgChartCacheService,
    OrgchartCancelRegistryService,
    OrgChartTheOrgEnrichmentService,
    OrgChartLinkedInBuildService,
    PdlPersonOrgMovementService,
    CoreSignalPersonOrgMovementService,
    ContactOutPersonOrgMovementService,
    PersonOrgMovementService,
  ],
})
export class OrgChartModule {}
