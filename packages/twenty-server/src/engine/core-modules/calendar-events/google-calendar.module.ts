import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { AppToken } from 'src/engine/core-modules/app-token/app-token.entity';
import { JwtAuthStrategy } from 'src/engine/core-modules/auth/strategies/jwt.auth.strategy';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { WorkspaceCacheStorageService } from 'src/engine/workspace-cache-storage/workspace-cache-storage.service';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  imports: [JwtModule, TypeORMModule, TypeOrmModule.forFeature([Workspace], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata'), TypeOrmModule.forFeature([User], 'core'), TypeOrmModule.forFeature([AppToken], 'core'),    TypeOrmModule.forFeature([UserWorkspace], 'core'), DataSourceModule],
  controllers: [GoogleCalendarController],
  providers: [GoogleCalendarService,DataSourceService, JwtAuthStrategy, AccessTokenService, WorkspaceCacheStorageService
  ],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
