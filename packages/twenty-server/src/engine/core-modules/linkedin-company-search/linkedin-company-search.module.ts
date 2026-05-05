import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { LinkedinCompanySearchController } from 'src/engine/core-modules/linkedin-company-search/controllers/linkedin-company-search.controller';
import { LinkedinCompanySearchService } from 'src/engine/core-modules/linkedin-company-search/services/linkedin-company-search.service';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, BrightDataModule, WorkspaceCacheStorageModule],
  controllers: [LinkedinCompanySearchController],
  providers: [LinkedinCompanySearchService],
  exports: [LinkedinCompanySearchService],
})
export class LinkedinCompanySearchModule {}
