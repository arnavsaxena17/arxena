import { Module } from '@nestjs/common';

import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { GetLocalBusinessDetailsWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/get-local-business-details.workflow-action';
import { SearchLocalBusinessesWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/search-local-businesses.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule],
  providers: [
    SearchLocalBusinessesWorkflowAction,
    GetLocalBusinessDetailsWorkflowAction,
  ],
  exports: [
    SearchLocalBusinessesWorkflowAction,
    GetLocalBusinessDetailsWorkflowAction,
  ],
})
export class LocalBusinessDataActionModule {}
