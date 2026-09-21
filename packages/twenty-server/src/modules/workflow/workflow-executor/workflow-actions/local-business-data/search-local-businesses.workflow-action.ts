import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { SearchLocalBusinessesTool } from 'src/engine/core-modules/tool/tools/local-business-data-tool/search-local-businesses-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { isWorkflowSearchLocalBusinessesAction } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/guards/is-workflow-search-local-businesses-action.guard';
import { type WorkflowSearchLocalBusinessesActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/types/workflow-search-local-businesses-action-input.type';
import { buildLocalBusinessDataStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/utils/build-local-business-data-step-log.util';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class SearchLocalBusinessesWorkflowAction extends ToolBackedWorkflowAction<WorkflowSearchLocalBusinessesActionInput> {
  constructor(
    private readonly searchLocalBusinessesTool: SearchLocalBusinessesTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(SearchLocalBusinessesWorkflowAction.name, workflowRunStepLogService);
  }

  protected getTool(): Tool {
    return this.searchLocalBusinessesTool;
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowSearchLocalBusinessesAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a search-local-businesses action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowSearchLocalBusinessesActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildLocalBusinessDataStepLog({
      actionType: 'SEARCH_LOCAL_BUSINESSES',
      query: input.query,
      output,
      durationMs,
    });
  }
}
