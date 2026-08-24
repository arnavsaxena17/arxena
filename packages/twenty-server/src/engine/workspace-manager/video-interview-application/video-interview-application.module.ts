import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { ApplicationManifestModule } from 'src/engine/core-modules/application/application-manifest/application-manifest.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { VideoInterviewApplicationService } from 'src/engine/workspace-manager/video-interview-application/services/video-interview-application.service';

@Module({
  imports: [ApplicationModule, ApplicationManifestModule, WorkspaceCacheModule],
  providers: [VideoInterviewApplicationService],
  exports: [VideoInterviewApplicationService],
})
export class VideoInterviewApplicationModule {}
