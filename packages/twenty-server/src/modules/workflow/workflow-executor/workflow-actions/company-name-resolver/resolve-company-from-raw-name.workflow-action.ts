import { Injectable } from '@nestjs/common';

import { type WorkflowRunStepLog } from 'twenty-shared/workflow';

import { ResolveCompanyFromRawNameTool } from 'src/engine/core-modules/tool/tools/company-name-resolver-tool/resolve-company-from-raw-name-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { isWorkflowResolveCompanyFromRawNameAction } from 'src/modules/workflow/workflow-executor/workflow-actions/company-name-resolver/guards/is-workflow-resolve-company-from-raw-name-action.guard';
import { type WorkflowResolveCompanyFromRawNameActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/company-name-resolver/types/workflow-resolve-company-from-raw-name-action-input.type';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

@Injectable()
export class ResolveCompanyFromRawNameWorkflowAction extends ToolBackedWorkflowAction<WorkflowResolveCompanyFromRawNameActionInput> {
  constructor(
    private readonly resolveCompanyFromRawNameTool: ResolveCompanyFromRawNameTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(
      ResolveCompanyFromRawNameWorkflowAction.name,
      workflowRunStepLogService,
    );
  }

  protected getTool(): Tool {
    return this.resolveCompanyFromRawNameTool;
  }

  protected assertStep(step: WorkflowAction): void {
    if (!isWorkflowResolveCompanyFromRawNameAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not a resolve-company-from-raw-name action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected buildStepLog({
    output,
    durationMs,
  }: {
    input: WorkflowResolveCompanyFromRawNameActionInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return {
      details: {
        type: 'CODE',
        durationMs,
        status: output.success ? 'SUCCESS' : 'ERROR',
        error: output.error
          ? {
              type: 'ResolveCompanyFromRawNameError',
              message: output.error,
            }
          : null,
      },
      entries: [
        {
          timestamp: new Date().toISOString(),
          level: output.success ? 'info' : 'error',
          message: output.message ?? (output.success ? 'OK' : 'Failed'),
        },
      ],
      sizeBytes: 0,
    };
  }
}
