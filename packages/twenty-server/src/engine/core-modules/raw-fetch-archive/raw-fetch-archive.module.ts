import { Global, Module } from '@nestjs/common';

import { RawFetchArchiveService } from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.service';

// Global so every provider client can archive without per-module wiring
@Global()
@Module({
  providers: [RawFetchArchiveService],
  exports: [RawFetchArchiveService],
})
export class RawFetchArchiveModule {}
