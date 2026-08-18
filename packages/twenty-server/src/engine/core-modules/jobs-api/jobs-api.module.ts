import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { JobsApiController } from './jobs-api.controller';
import { JobApiService } from './jobs-api.service';
import { JobSearchDataSourceResolver } from './services/job-search-data-source.resolver';

@Module({
  imports: [
    OrgChartModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    AuthModule,
    WorkspaceCacheStorageModule,
    WorkspaceModificationsModule,
  ],
  controllers: [JobsApiController],
  providers: [JobApiService, JobSearchDataSourceResolver, JwtAuthGuard],
  exports: [JobApiService],
})
export class JobsApiModule {}
