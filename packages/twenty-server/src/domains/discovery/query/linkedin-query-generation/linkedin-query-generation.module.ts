import { Module } from '@nestjs/common';

import { DiscoveryQueryModule } from 'src/domains/discovery/query/query.module';
import { LinkedinQueryGenerationController } from 'src/domains/discovery/query/linkedin-query-generation/controllers/linkedin-query-generation.controller';
import { LinkedinQueryGenerationService } from 'src/domains/discovery/query/linkedin-query-generation/services/linkedin-query-generation.service';

@Module({
  imports: [DiscoveryQueryModule],
  controllers: [LinkedinQueryGenerationController],
  providers: [LinkedinQueryGenerationService],
  exports: [LinkedinQueryGenerationService],
})
export class LinkedinQueryGenerationModule {}
