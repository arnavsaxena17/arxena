import { Module } from '@nestjs/common';

import { ContactEnrichmentModule } from 'src/engine/core-modules/contact-enrichment/contact-enrichment.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { GraphQLExecutionModule } from 'src/engine/core-modules/graphql/graphql-execution.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

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
    EnvironmentModule,
    ContactEnrichmentModule,
    GraphQLExecutionModule,
    LinkedInSearchModule,
    WorkspaceModificationsModule,
  ],
  controllers: [OrgChartController],
  providers: [
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
