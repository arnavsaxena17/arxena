import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { UnipilePoolModule } from '../arx-chat/unipile-pool.module';
import { WarmPathResolverService } from './warm-path-resolver.service';
import { WarmPathsController } from './warm-paths.controller';

@Module({
  imports: [
    AuthModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    WorkspaceModificationsModule,
  ],
  controllers: [WarmPathsController],
  providers: [WarmPathResolverService],
  exports: [WarmPathResolverService],
})
export class WarmPathsModule {}
