import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { ApplicationManifestModule } from 'src/engine/core-modules/application/application-manifest/application-manifest.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { ShortlistPresentationApplicationService } from 'src/engine/workspace-manager/shortlist-presentation-application/services/shortlist-presentation-application.service';

@Module({
  imports: [ApplicationModule, ApplicationManifestModule, WorkspaceCacheModule],
  providers: [ShortlistPresentationApplicationService],
  exports: [ShortlistPresentationApplicationService],
})
export class ShortlistPresentationApplicationModule {}
