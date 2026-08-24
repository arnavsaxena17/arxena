import { Module } from '@nestjs/common';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { ApplicationManifestModule } from 'src/engine/core-modules/application/application-manifest/application-manifest.module';
import { WorkspaceCacheModule } from 'src/engine/workspace-cache/workspace-cache.module';
import { AssistantApplicationService } from 'src/engine/workspace-manager/assistant-application/services/assistant-application.service';

@Module({
  imports: [ApplicationModule, ApplicationManifestModule, WorkspaceCacheModule],
  providers: [AssistantApplicationService],
  exports: [AssistantApplicationService],
})
export class AssistantApplicationModule {}
