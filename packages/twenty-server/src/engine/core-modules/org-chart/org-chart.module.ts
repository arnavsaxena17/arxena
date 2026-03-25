import { Module } from '@nestjs/common';

import { ApifyModule } from 'src/engine/core-modules/apify/apify.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { TheOrgModule } from 'src/engine/core-modules/theorg/theorg.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';

import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';

import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompanyLogoService } from './services/company-logo.service';
import { ImageProxyService } from './services/image-proxy.service';
import { OrgChartEsService } from './services/org-chart-es.service';
import { OrgChartService } from './services/org-chart.service';
import { OrgChartTheOrgEnrichmentService } from './services/org-chart-theorg-enrichment.service';
import { OrgChartS3Service } from './services/orgchart-s3.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PeopleEsService } from './services/people-es.service';
import { PythonOrgChartService } from './services/python-org-chart.service';

@Module({
  imports: [
    OrgChartClientIpModule,
    ApifyModule,
    BillingModule,
    ContactEnrichmentModule,
    EnvironmentModule,
    GraphQLExecutionModule,
    LinkedInSearchModule,
    TheOrgModule,
    WorkspaceModificationsModule,
  ],
  controllers: [OrgChartController],
  providers: [
    UnipileCompanyService,
    WorkspaceMemberProfileUnipileService,
    OrgChartService,
    OrgChartTheOrgEnrichmentService,
    ArxenaBackendService,
    OrgChartEsService,
    PeopleEsService,
    PdlAutocompleteService,
    CompanyLogoService,
    ImageProxyService,
    PythonOrgChartService,
    OrgChartS3Service,
  ],
  exports: [OrgChartService, OrgChartS3Service, OrgChartTheOrgEnrichmentService],
})
export class OrgChartModule {}
