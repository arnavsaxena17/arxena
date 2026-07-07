import { Module } from '@nestjs/common';

import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';

import { PeopleApiController } from './people-api.controller';
import { PeopleApiService } from './people-api.service';

@Module({
  imports: [OrgChartModule, CandidateSearchModule],
  controllers: [PeopleApiController],
  providers: [PeopleApiService],
  exports: [PeopleApiService],
})
export class PeopleApiModule {}
