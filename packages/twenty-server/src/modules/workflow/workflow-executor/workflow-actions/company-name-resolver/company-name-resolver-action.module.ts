import { Module } from '@nestjs/common';

import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import { ResolveCompanyFromRawNameWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/company-name-resolver/resolve-company-from-raw-name.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule],
  providers: [ResolveCompanyFromRawNameWorkflowAction],
  exports: [ResolveCompanyFromRawNameWorkflowAction],
})
export class CompanyNameResolverActionModule {}
