import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { GeoModule } from 'src/engine/core-modules/geo/geo.module';
import { OrgChartClientIpModule } from 'src/engine/core-modules/org-chart/org-chart-client-ip.module';
import { WebsiteTrackerController } from 'src/engine/core-modules/website-tracker/website-tracker.controller';
import { WebsiteTrackerService } from 'src/engine/core-modules/website-tracker/website-tracker.service';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { GlobalWorkspaceDataSourceModule } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-datasource.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    AuthModule,
    WorkspaceCacheStorageModule,
    GeoModule,
    OrgChartClientIpModule,
    WorkspaceModificationsModule,
    GlobalWorkspaceDataSourceModule,
  ],
  controllers: [WebsiteTrackerController],
  providers: [WebsiteTrackerService, JwtAuthGuard],
  exports: [WebsiteTrackerService],
})
export class WebsiteTrackerModule {}
