import { Module } from '@nestjs/common';

import { CacheStorageModule } from 'src/engine/core-modules/cache-storage/cache-storage.module';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';

import { ApifyEmployeeCountService } from './services/apify-employee-count.service';
import { ApifyService } from './services/apify.service';

@Module({
  imports: [EnvironmentModule, CacheStorageModule],
  providers: [ApifyService, ApifyEmployeeCountService],
  exports: [ApifyService, ApifyEmployeeCountService],
})
export class ApifyModule {}
