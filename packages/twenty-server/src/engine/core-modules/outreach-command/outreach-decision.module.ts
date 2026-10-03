import { Module } from '@nestjs/common';

import { OutreachDecisionService } from 'src/engine/core-modules/outreach-command/services/outreach-decision.service';

// Thin module so the form action and workflow runner can write decisions
// without importing OutreachCommandModule.
@Module({
  providers: [OutreachDecisionService],
  exports: [OutreachDecisionService],
})
export class OutreachDecisionModule {}
