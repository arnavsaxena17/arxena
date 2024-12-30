// google-drive.module.ts
import { Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';

@Module({
  providers: [GoogleDriveService],
  controllers: [GoogleDriveController],
  exports: [GoogleDriveService],
})
export class GoogleDriveModule {}
