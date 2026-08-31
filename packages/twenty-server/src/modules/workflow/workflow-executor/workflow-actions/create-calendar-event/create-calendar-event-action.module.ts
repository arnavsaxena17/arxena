import { Module } from '@nestjs/common';

import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';
import { CreateCalendarEventWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/create-calendar-event/create-calendar-event.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule, OutreachCommandModule],
  providers: [CreateCalendarEventWorkflowAction],
  exports: [CreateCalendarEventWorkflowAction],
})
export class CreateCalendarEventActionModule {}
