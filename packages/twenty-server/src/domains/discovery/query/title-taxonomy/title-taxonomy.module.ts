import { Module } from '@nestjs/common';

import { TitleTaxonomyRemoteService } from 'src/domains/discovery/query/title-taxonomy-remote.service';
import { TitleExpansionService } from 'src/domains/discovery/query/title-taxonomy/title-expansion.service';

// No dependencies, so any module can import it without a cycle
@Module({
  providers: [TitleTaxonomyRemoteService, TitleExpansionService],
  exports: [TitleTaxonomyRemoteService, TitleExpansionService],
})
export class TitleTaxonomyModule {}
