import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { ApplicationManifestModule } from 'src/engine/core-modules/application/application-manifest/application-manifest.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

@Module({
  imports: [ApplicationModule, ApplicationManifestModule, WorkspaceCacheModule],
  providers: [ArxenaStandardApplicationService],
  exports: [ArxenaStandardApplicationService],
})
export class ArxenaStandardMetadataModule {}
