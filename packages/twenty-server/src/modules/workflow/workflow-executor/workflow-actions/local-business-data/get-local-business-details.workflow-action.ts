import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { GetLocalBusinessDetailsTool } from 'src/engine/core-modules/tool/tools/local-business-data-tool/get-local-business-details-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { isWorkflowGetLocalBusinessDetailsAction } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/guards/is-workflow-get-local-business-details-action.guard';
import { type WorkflowGetLocalBusinessDetailsActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/types/workflow-get-local-business-details-action-input.type';
import { buildLocalBusinessDataStepLog } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/utils/build-local-business-data-step-log.util';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class GetLocalBusinessDetailsWorkflowAction extends ToolBackedWorkflowAction<WorkflowGetLocalBusinessDetailsActionInput> {
  constructor(
    private readonly getLocalBusinessDetailsTool: GetLocalBusinessDetailsTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(
      GetLocalBusinessDetailsWorkflowAction.name,
      workflowRunStepLogService,
    );
  }

  protected getTool(): Tool {
    return this.getLocalBusinessDetailsTool;
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowGetLocalBusinessDetailsAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a get-local-business-details action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: WorkflowGetLocalBusinessDetailsActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildLocalBusinessDataStepLog({
      actionType: 'GET_LOCAL_BUSINESS_DETAILS',
      businessIds: input.businessIds,
      output,
      durationMs,
    });
  }
}
