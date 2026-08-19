import { Module } from '@nestjs/common';

import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LinkedInSearchModule } from 'src/engine/core-modules/linkedin-search/linkedin-search.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceModificationsModule } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.module';

import { PostsApiController } from './posts-api.controller';
import { PostsApiService } from './posts-api.service';
import { PostSearchDataSourceResolver } from './services/post-search-data-source.resolver';
import { PostSearchHitTransformer } from './services/post-search-hit.transformer';

@Module({
  imports: [
    OrgChartModule,
    LinkedInSearchModule,
    UnipilePoolModule,
    AuthModule,
    WorkspaceCacheStorageModule,
    WorkspaceModificationsModule,
  ],
  controllers: [PostsApiController],
  providers: [
    PostsApiService,
    PostSearchDataSourceResolver,
    PostSearchHitTransformer,
    JwtAuthGuard,
  ],
  exports: [PostsApiService],
})
export class PostsApiModule {}
