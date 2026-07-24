import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { TheOfficialBoardController } from 'src/engine/core-modules/theofficialboard/controllers/theofficialboard.controller';
import { TheOfficialBoardService } from 'src/engine/core-modules/theofficialboard/services/theofficialboard.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, BrightDataModule, WorkspaceCacheStorageModule],
  controllers: [TheOfficialBoardController],
  providers: [TheOfficialBoardService],
  exports: [TheOfficialBoardService],
})
export class TheOfficialBoardModule {}
