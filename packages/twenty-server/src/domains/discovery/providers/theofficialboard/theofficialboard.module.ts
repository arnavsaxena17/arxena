import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { TheOfficialBoardController } from 'src/domains/discovery/providers/theofficialboard/controllers/theofficialboard.controller';
import { TheOfficialBoardService } from 'src/domains/discovery/providers/theofficialboard/services/theofficialboard.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, BrightDataModule, WorkspaceCacheStorageModule],
  controllers: [TheOfficialBoardController],
  providers: [TheOfficialBoardService],
  exports: [TheOfficialBoardService],
})
export class TheOfficialBoardModule {}
