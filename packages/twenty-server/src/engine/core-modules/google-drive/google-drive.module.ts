// google-drive.module.ts
import { Module } from '@nestjs/common';
import { CronDriveService } from './cron-drive.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { GraphQLExecutionModule } from '../graphql/graphql-execution.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { WorkspaceEntity } from '../workspace/workspace.entity';
import { CallAndSMSProcessingService } from './call-sms-processing';
import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveService } from './google-drive.service';

@Module({
  imports: [
    AuthModule,
    WorkspaceModificationsModule,
    DataSourceModule,
    TypeORMModule,
    GraphQLExecutionModule,
    TypeOrmModule.forFeature([WorkspaceEntity, FeatureFlagEntity]),
    TypeOrmModule.forFeature([DataSourceEntity])
  ],
  providers: [
    GoogleDriveService,
    AttachmentProcessingService,
    CallAndSMSProcessingService,
    CronDriveService,
    WorkspaceDataSourceService
  ],
  controllers: [GoogleDriveController],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
