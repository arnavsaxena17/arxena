import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/domains/discovery/providers/bright-data/bright-data.module';
import { BuiltWithService } from 'src/domains/discovery/providers/builtwith/services/builtwith.service';

@Module({
  imports: [AuthModule, BrightDataModule],
  providers: [BuiltWithService],
  exports: [BuiltWithService],
})
export class BuiltWithModule {}
