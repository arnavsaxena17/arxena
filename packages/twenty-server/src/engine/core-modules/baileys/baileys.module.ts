import { Module } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { WorkspaceDataSourceModule } from 'src/engine/workspace-datasource/workspace-datasource.module';
import { WebSocketModule } from 'src/modules/websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyService } from '../auth/services/api-key.service';
import { JwtAuthStrategy } from '../auth/strategies/jwt.auth.strategy';
import { AccessTokenService } from '../auth/token/services/access-token.service';
import { CacheStorageModule } from '../cache-storage/cache-storage.module';
import { EnvironmentModule } from '../environment/environment.module';
import { EnvironmentService } from '../environment/environment.service';
import { JwtModule } from '../jwt/jwt.module';
import { JwtWrapperService } from '../jwt/services/jwt-wrapper.service';
import { UserWorkspace } from '../user-workspace/user-workspace.entity';
import { User } from '../user/user.entity';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { Workspace } from '../workspace/workspace.entity';

import { BaileysController } from './baileys.controller';
import { BaileysService } from './baileys.service';
import { WebSocketService } from './websocket.service';

@Module({
  imports: [
    AuthModule,
    DataSourceModule,
    TypeORMModule,
    WorkspaceModificationsModule,
    WebSocketModule,
    CacheStorageModule,
    WorkspaceCacheStorageModule,
    EnvironmentModule,
    JwtModule,
    WorkspaceDataSourceModule,
    TypeOrmModule.forFeature([User, Workspace, UserWorkspace], 'core'),
    TypeOrmModule.forFeature([DataSourceEntity], 'metadata'),
    NestJwtModule.registerAsync({
      useFactory: (environmentService: EnvironmentService) => ({
        secret: environmentService.get('APP_SECRET'),
        signOptions: {
          expiresIn: environmentService.get('ACCESS_TOKEN_EXPIRES_IN'),
        },
      }),
      inject: [EnvironmentService],
    }),
  ],
  providers: [
    BaileysService,
    WebSocketService,
    JwtAuthStrategy,
    AccessTokenService,
    ApiKeyService,
    JwtWrapperService,
    EnvironmentService,
  ],
  controllers: [BaileysController],
  exports: [BaileysService],
})
export class BaileysModule {} 