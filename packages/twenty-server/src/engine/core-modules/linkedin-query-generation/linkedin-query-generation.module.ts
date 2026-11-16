import { Module } from '@nestjs/common';

import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { LinkedinQueryGenerationController } from 'src/engine/core-modules/linkedin-query-generation/controllers/linkedin-query-generation.controller';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { SourcingSpecParserService } from 'src/engine/core-modules/linkedin-query-generation/services/sourcing-spec-parser.service';

@Module({
  imports: [CandidateSearchModule],
  controllers: [LinkedinQueryGenerationController],
  providers: [LinkedinQueryGenerationService, SourcingSpecParserService],
  exports: [LinkedinQueryGenerationService, SourcingSpecParserService],
})
export class LinkedinQueryGenerationModule {}
