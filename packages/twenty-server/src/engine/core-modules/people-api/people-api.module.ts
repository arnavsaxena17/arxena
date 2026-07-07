import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { PeopleApiController } from './people-api.controller';
import { PeopleApiService } from './people-api.service';

@Module({
  imports: [
    OrgChartModule,
    CandidateSearchModule,
    AuthModule,
    WorkspaceCacheStorageModule,
  ],
  controllers: [PeopleApiController],
  providers: [PeopleApiService, JwtAuthGuard],
  exports: [PeopleApiService],
})
export class PeopleApiModule {}
