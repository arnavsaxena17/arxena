import { forwardRef, Module } from '@nestjs/common';

import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { SourcingJudgeService } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-judge.service';
import { SourcingRunService } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.service';
import { LinkedinQueryGenerationModule } from 'src/engine/core-modules/linkedin-query-generation/linkedin-query-generation.module';
import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';

// The server-owned sourcing loop. It drives the search tools through the tool
// registry, which is resolved at run time (SourcingRunService.toolRegistry):
// ToolModule imports this module for sourcing_start / sourcing_next, and the
// registry's module imports ToolModule.
@Module({
  imports: [
    forwardRef(() => OutreachCommandModule),
    forwardRef(() => CandidateSourcingModule),
    LinkedinQueryGenerationModule,
  ],
  providers: [SourcingJudgeService, SourcingRunService],
  exports: [SourcingJudgeService, SourcingRunService],
})
export class SourcingRunModule {}
