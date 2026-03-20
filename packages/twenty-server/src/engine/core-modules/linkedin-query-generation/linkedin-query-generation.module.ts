import { Module } from '@nestjs/common';

import { CandidateSearchModule } from 'src/engine/core-modules/candidate-search/candidate-search.module';
import { LinkedinQueryGenerationController } from 'src/engine/core-modules/linkedin-query-generation/controllers/linkedin-query-generation.controller';
import { IterativeLinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/iterative-linkedin-query-generation.service';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';

@Module({
  imports: [CandidateSearchModule],
  controllers: [LinkedinQueryGenerationController],
  providers: [
    LinkedinQueryGenerationService,
    IterativeLinkedinQueryGenerationService,
  ],
  exports: [
    LinkedinQueryGenerationService,
    IterativeLinkedinQueryGenerationService,
  ],
})
export class LinkedinQueryGenerationModule {}
