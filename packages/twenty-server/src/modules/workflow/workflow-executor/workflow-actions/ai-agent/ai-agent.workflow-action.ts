import { Injectable } from '@nestjs/common';

import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/interfaces/workflow-action.interface';

import { ScopedWorkspaceContextFactory } from 'src/engine/twenty-orm/factories/scoped-workspace-context.factory';
import {
  WorkflowStepExecutorException,
  WorkflowStepExecutorExceptionCode,
} from 'src/modules/workflow/workflow-executor/exceptions/workflow-step-executor.exception';
import { type WorkflowActionInput } from 'src/modules/workflow/workflow-executor/types/workflow-action-input';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { findStepOrThrow } from 'src/modules/workflow/workflow-executor/utils/find-step-or-throw.util';
import { resolveInput } from 'src/modules/workflow/workflow-executor/utils/variable-resolver.util';
import { isWorkflowAiAgentAction } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/guards/is-workflow-ai-agent-action.guard';
import { AgentExecutionService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/services/agent-execution.service';
import { type WorkflowAiAgentActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/types/workflow-ai-agent-action-input.type';

@Injectable()
export class AiAgentWorkflowAction implements WorkflowAction {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly scopedWorkspaceContextFactory: ScopedWorkspaceContextFactory,
  ) {}

  async execute({
    currentStepId,
    steps,
    context,
  }: WorkflowActionInput): Promise<WorkflowActionOutput> {
    try {
      const step = findStepOrThrow({ stepId: currentStepId, steps });

      if (!isWorkflowAiAgentAction(step)) {
        throw new WorkflowStepExecutorException(
          'Step is not an AI agent action',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
        );
      }

      const workflowActionInput = resolveInput(
        step.settings.input,
        context,
      ) as WorkflowAiAgentActionInput;

      if (!workflowActionInput.prompt) {
        throw new WorkflowStepExecutorException(
          'AI agent prompt is required',
          WorkflowStepExecutorExceptionCode.INVALID_STEP_INPUT,
        );
      }

      const { workspaceId } = this.scopedWorkspaceContextFactory.create();

      const result = await this.agentExecutionService.executeAgent({
        prompt: workflowActionInput.prompt,
        systemPrompt: workflowActionInput.systemPrompt,
        agentId: workflowActionInput.agentId,
        workspaceId: workspaceId ?? undefined,
      });

      return { result };
    } catch (error) {
      return { error: error.message };
    }
  }
}
