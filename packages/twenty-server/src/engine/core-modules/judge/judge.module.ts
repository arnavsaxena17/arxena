import { Module } from '@nestjs/common';

import { ArxWebSearchModule } from 'src/engine/core-modules/arx-web-search/arx-web-search.module';
import { AiFilterEngineService } from 'src/engine/core-modules/judge/ai-filter-engine/ai-filter-engine.service';
import { JudgeService } from 'src/engine/core-modules/judge/judge.service';

// Judging is shared by every surface that sorts people: the sourcing tools, the
// ludicrous relevance judge and the AI column. This module owns both the model
// routing (AiFilterEngineService) and the rubric/stage/score on top of it, so
// consumers import one module instead of reaching into candidate-sourcing.
@Module({
  imports: [ArxWebSearchModule],
  providers: [AiFilterEngineService, JudgeService],
  exports: [AiFilterEngineService, JudgeService],
})
export class JudgeModule {}
