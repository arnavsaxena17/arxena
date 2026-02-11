import { Module } from '@nestjs/common';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';

import { OrgChartController } from './controllers/org-chart.controller';
import { ArxenaBackendService } from './services/arxena-backend.service';
import { CompanyLogoService } from './services/company-logo.service';
import { OrgChartEsService } from './services/org-chart-es.service';
import { OrgChartService } from './services/org-chart.service';
import { PdlAutocompleteService } from './services/pdl-autocomplete.service';
import { PeopleEsService } from './services/people-es.service';
import { PythonOrgChartService } from './services/python-org-chart.service';

@Module({
  imports: [EnvironmentModule],
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
