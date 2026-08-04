import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { BuiltWithController } from 'src/engine/core-modules/builtwith/controllers/builtwith.controller';
import { BuiltWithService } from 'src/engine/core-modules/builtwith/services/builtwith.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

// WorkspaceCacheStorageModule is required for the controller's JwtAuthGuard
@Module({
  imports: [AuthModule, BrightDataModule, WorkspaceCacheStorageModule],
  controllers: [BuiltWithController],
  providers: [BuiltWithService],
  exports: [BuiltWithService],
})
export class BuiltWithModule {}
