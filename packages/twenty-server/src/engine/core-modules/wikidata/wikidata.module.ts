import { Module } from '@nestjs/common';

import { AuthModule } from 'src/engine/core-modules/auth/auth.module';
import { WikidataController } from 'src/engine/core-modules/wikidata/controllers/wikidata.controller';
import { WikidataCompanySearchService } from 'src/engine/core-modules/wikidata/services/wikidata-company-search.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

@Module({
  imports: [AuthModule, WorkspaceCacheStorageModule],
  controllers: [WikidataController],
  providers: [WikidataCompanySearchService, JwtAuthGuard],
  exports: [WikidataCompanySearchService],
})
export class WikidataModule {}
