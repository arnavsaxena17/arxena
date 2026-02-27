import { Module } from '@nestjs/common';

import { ApifyModule } from 'src/engine/core-modules/apify/apify.module';
import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';

import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompanyLogoService } from './services/company-logo.service';
import { OrgChartEsService } from './services/org-chart-es.service';
import { OrgChartService } from './services/org-chart.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PeopleEsService } from './services/people-es.service';
import { PythonOrgChartService } from './services/python-org-chart.service';

@Module({
  imports: [
    ApifyModule,
    BillingModule,
    EnvironmentModule,
    ContactEnrichmentModule,
    GraphQLExecutionModule,
    LinkedInSearchModule,
    WorkspaceModificationsModule,
  ],
  controllers: [OrgChartController],
  providers: [
    WorkspaceMemberProfileUnipileService,
    OrgChartService,
    ArxenaBackendService,
    OrgChartEsService,
    PeopleEsService,
    PdlAutocompleteService,
    CompanyLogoService,
    PythonOrgChartService,
  ],
  exports: [OrgChartService],
})
export class OrgChartModule {}
