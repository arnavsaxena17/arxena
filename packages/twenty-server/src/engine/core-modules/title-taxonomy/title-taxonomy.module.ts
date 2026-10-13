import { Module } from '@nestjs/common';

import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { TitleExpansionService } from 'src/engine/core-modules/title-taxonomy/title-expansion.service';

// No dependencies, so any module can import it without a cycle
@Module({
  providers: [TitleTaxonomyRemoteService, TitleExpansionService],
  exports: [TitleTaxonomyRemoteService, TitleExpansionService],
})
export class TitleTaxonomyModule {}
