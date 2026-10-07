import { Injectable } from '@nestjs/common';

import {
  WorkflowActionType,
  type WorkflowRunStepLog,
} from 'twenty-shared/workflow';

import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';
import { type SearchBrightDataBusinessToolInput } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { ToolBackedWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/tool-backed/tool-backed.workflow-action';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowRunStepLogWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run-step-log.workspace-service';

import { buildBrightDataBusinessSearchStepLog } from './utils/build-bright-data-business-search-step-log.util';

const DEFAULT_WORKFLOW_BUDGET_USD = 1;

type BrightDataBusinessSearchWorkflowInput = Omit<
  SearchBrightDataBusinessToolInput,
  'entity'
> & { entity?: 'company' | 'people' };

abstract class BrightDataBusinessSearchWorkflowAction extends ToolBackedWorkflowAction<SearchBrightDataBusinessToolInput> {
  protected constructor(
    loggerName: string,
    private readonly entity: 'company' | 'people',
    private readonly expectedType: WorkflowActionType,
    private readonly searchBrightDataBusinessTool: SearchBrightDataBusinessTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(loggerName, workflowRunStepLogService);
  }

  protected getTool(): Tool {
    return this.searchBrightDataBusinessTool;
  }

  protected assertStep(step: WorkflowAction): void {
    if (step.type !== this.expectedType) {
      throw new WorkflowStepExecutorException(
        `Step is not a ${this.expectedType} action`,
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }
  }

  protected async preprocessInput(
    rawInput: SearchBrightDataBusinessToolInput,
  ): Promise<SearchBrightDataBusinessToolInput> {
    const input = rawInput as BrightDataBusinessSearchWorkflowInput;

    return {
      ...input,
      entity: this.entity,
      mode: input.mode ?? 'ludicrous',
      view: input.view ?? 'full',
      // A workflow cannot pause for the budget confirmation, so the step runs
      // inside its own maxBudgetUsd cap instead
      autoExecute: true,
      maxBudgetUsd: input.maxBudgetUsd ?? DEFAULT_WORKFLOW_BUDGET_USD,
    };
  }

  protected buildStepLog({
    input,
    output,
    durationMs,
  }: {
    input: SearchBrightDataBusinessToolInput;
    output: ToolOutput;
    durationMs: number;
  }): WorkflowRunStepLog {
    return buildBrightDataBusinessSearchStepLog({
      query: input.query,
      output,
      durationMs,
    });
  }
}

@Injectable()
export class SearchBrightDataCompaniesWorkflowAction extends BrightDataBusinessSearchWorkflowAction {
  constructor(
    searchBrightDataBusinessTool: SearchBrightDataBusinessTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(
      SearchBrightDataCompaniesWorkflowAction.name,
      'company',
      WorkflowActionType.SEARCH_BRIGHT_DATA_COMPANIES,
      searchBrightDataBusinessTool,
      workflowRunStepLogService,
    );
  }
}

@Injectable()
export class SearchBrightDataPeopleWorkflowAction extends BrightDataBusinessSearchWorkflowAction {
  constructor(
    searchBrightDataBusinessTool: SearchBrightDataBusinessTool,
    workflowRunStepLogService: WorkflowRunStepLogWorkspaceService,
  ) {
    super(
      SearchBrightDataPeopleWorkflowAction.name,
      'people',
      WorkflowActionType.SEARCH_BRIGHT_DATA_PEOPLE,
      searchBrightDataBusinessTool,
      workflowRunStepLogService,
    );
  }
}
