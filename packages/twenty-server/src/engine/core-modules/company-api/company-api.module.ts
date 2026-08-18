import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { CompanyApiController } from './company-api.controller';
import { CompanyApiService } from './company-api.service';
import { CompanySearchDataSourceResolver } from './services/company-search-data-source.resolver';

@Module({
  imports: [
    OrgChartModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    AuthModule,
    WorkspaceCacheStorageModule,
    WorkspaceModificationsModule,
  ],
  controllers: [CompanyApiController],
  providers: [
    CompanyApiService,
    CompanySearchDataSourceResolver,
    JwtAuthGuard,
  ],
  exports: [CompanyApiService],
})
export class CompanyApiModule {}
