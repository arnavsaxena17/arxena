import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceCacheStorageModule,
    JwtModule,
    TypeORMModule,
    TypeOrmModule.forFeature([WorkspaceEntity]),
    TypeOrmModule.forFeature([DataSourceEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([AppTokenEntity]),
    TypeOrmModule.forFeature([UserWorkspaceEntity]),
  ],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
