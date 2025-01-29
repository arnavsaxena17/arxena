// google-drive.module.ts
import { Module } from '@nestjs/common';
import { CronDriveService } from './cron-drive.service';

import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';
import { MetadataEngineModule } from 'src/engine/metadata-modules/metadata-engine.module';
import { CoreEngineModule } from '../core-engine.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModificationsModule } from '../workspace-modifications/workspace-modifications.module';
import { DataSourceModule } from 'src/engine/metadata-modules/data-source/data-source.module';
import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../workspace/workspace.entity';
import { FeatureFlagEntity } from '../feature-flag/feature-flag.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { CallAndSMSProcessingService } from './call-sms-processing';
import { AttachmentProcessingService } from '../arx-chat/services/candidate-engagement/attachment-processes';

@Module({
  imports: [AuthModule, WorkspaceModificationsModule, DataSourceModule, TypeORMModule, TypeOrmModule.forFeature([Workspace, FeatureFlagEntity], 'core'), TypeOrmModule.forFeature([DataSourceEntity], 'metadata') ],
  providers: [GoogleDriveService,AttachmentProcessingService, CallAndSMSProcessingService, CronDriveService, WorkspaceDataSourceService],
  controllers: [GoogleDriveController],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
