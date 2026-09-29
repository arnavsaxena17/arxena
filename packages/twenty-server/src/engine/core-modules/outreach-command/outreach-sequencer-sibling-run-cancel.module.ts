import { Module } from '@nestjs/common';

import { OutreachSequencerSiblingRunCancelService } from 'src/engine/core-modules/outreach-command/services/outreach-sequencer-sibling-run-cancel.service';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

// Thin module so WorkflowRunner can cancel superseded sequencer runs without
// importing the full OutreachCommandModule (avoids Nest circular deps).
@Module({
  imports: [WorkflowRunModule],
  providers: [OutreachSequencerSiblingRunCancelService],
  exports: [OutreachSequencerSiblingRunCancelService],
})
export class OutreachSequencerSiblingRunCancelModule {}
