import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';

import { WorkspaceModificationsController } from './workspace-modifications.controller';
import { WorkspaceQueryService } from './workspace-modifications.service';

@Module({
  imports: [
    AuthModule,
    DataSourceModule,
    TypeORMModule,
    WebSocketModule,
    TypeOrmModule.forFeature([Workspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    JwtModule,
  ],
  providers: [
    WorkspaceCacheStorageService,
    EnvironmentService,
    WorkspaceQueryService,
    WorkspaceDataSourceService,
    ApiKeyService,
  ],
  controllers: [WorkspaceModificationsController],

  exports: [WorkspaceQueryService],
})
export class WorkspaceModificationsModule {}
