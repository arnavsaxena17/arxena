import { Global, Module } from '@nestjs/common';

import { JevEvaluationService } from 'src/engine/metadata-modules/ai/ai-evaluation/services/jev-evaluation.service';

@Global()
@Module({
  providers: [JevEvaluationService],
  exports: [JevEvaluationService],
})
export class AiEvaluationModule {}
