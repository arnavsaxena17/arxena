import { Module } from '@nestjs/common';

import { LinkedinQueryGenerationController } from 'src/engine/core-modules/linkedin-query-generation/controllers/linkedin-query-generation.controller';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';

@Module({
  controllers: [LinkedinQueryGenerationController],
  providers: [LinkedinQueryGenerationService],
  exports: [LinkedinQueryGenerationService],
})
export class LinkedinQueryGenerationModule {}
