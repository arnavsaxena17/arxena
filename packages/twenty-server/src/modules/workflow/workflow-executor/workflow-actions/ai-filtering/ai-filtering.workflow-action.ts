import { Injectable } from '@nestjs/common';

import { resolveInput } from 'twenty-shared/utils';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { isWorkflowAiFilteringAction } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/guards/is-workflow-ai-filtering-action.guard';
import { type WorkflowAiFilteringActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-action-input.type';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

@Injectable()
export class AiFilteringWorkflowAction implements WorkflowAction {
  constructor(
    private readonly workflowAiFilteringService: WorkflowAiFilteringService,
  ) {}

  async execute({
    currentStepId,
    steps,
    context,
    runInfo,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    const step = findStepOrThrow({
      stepId: currentStepId,
      steps,
    });

    if (!isWorkflowAiFilteringAction(step)) {
      throw new WorkflowStepExecutorException(
        'Step is not an AI Filtering action',
        WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
      );
    }

    const resolvedInput = resolveInput(
      step.settings.input,
      context,
    ) as WorkflowAiFilteringActionInput;

    const enqueueResult = await this.workflowAiFilteringService.enqueue({
      workspaceId: runInfo.workspaceId,
      workflowRunId: runInfo.workflowRunId,
      workflowStepId: currentStepId,
      input: resolvedInput,
    });

    return {
      pendingEvent: true,
      result: enqueueResult,
    };
  }
}
