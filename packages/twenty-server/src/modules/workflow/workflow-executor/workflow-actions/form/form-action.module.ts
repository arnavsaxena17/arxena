import { Module } from '@nestjs/common';

import { WorkflowApprovalModule } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-approval.module';
import { OutreachDecisionModule } from 'src/engine/core-modules/outreach-command/outreach-decision.module';
import { FormWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/form/form.workflow-action';

@Module({
  imports: [WorkflowApprovalModule, OutreachDecisionModule],
  providers: [FormWorkflowAction],
  exports: [FormWorkflowAction],
})
export class FormActionModule {}
