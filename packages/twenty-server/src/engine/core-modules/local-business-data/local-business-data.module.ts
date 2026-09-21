import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { LocalBusinessDataClient } from 'src/engine/core-modules/local-business-data/local-business-data.client';
import { LocalBusinessDataController } from 'src/engine/core-modules/local-business-data/local-business-data.controller';
import { LocalBusinessDataService } from 'src/engine/core-modules/local-business-data/local-business-data.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule],
  controllers: [LocalBusinessDataController],
  providers: [LocalBusinessDataClient, LocalBusinessDataService, JwtAuthGuard],
  exports: [LocalBusinessDataService],
})
export class LocalBusinessDataModule {}
