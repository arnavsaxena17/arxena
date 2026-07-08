import { Module } from '@nestjs/common';

import { ScopedWorkspaceContextFactory } from 'src/engine/twenty-orm/factories/scoped-workspace-context.factory';
import { AiAgentWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action';
import { AgentExecutionService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/services/agent-execution.service';

@Module({
  providers: [
    AiAgentWorkflowAction,
    AgentExecutionService,
    ScopedWorkspaceContextFactory,
  ],
  exports: [AiAgentWorkflowAction, AgentExecutionService],
})
export class AiAgentActionModule {}
