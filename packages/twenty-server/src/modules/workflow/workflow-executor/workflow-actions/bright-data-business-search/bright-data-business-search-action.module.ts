import { Module } from '@nestjs/common';

import { ToolModule } from 'src/engine/core-modules/tool/tool.module';
import {
  SearchBrightDataCompaniesWorkflowAction,
  SearchBrightDataPeopleWorkflowAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/bright-data-business-search/search-bright-data-business.workflow-action';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [ToolModule, WorkflowRunModule],
  providers: [
    SearchBrightDataCompaniesWorkflowAction,
    SearchBrightDataPeopleWorkflowAction,
  ],
  exports: [
    SearchBrightDataCompaniesWorkflowAction,
    SearchBrightDataPeopleWorkflowAction,
  ],
})
export class BrightDataBusinessSearchActionModule {}
