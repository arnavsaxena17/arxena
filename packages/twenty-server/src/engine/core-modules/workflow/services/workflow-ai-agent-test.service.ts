import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { FieldActorSource } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { buildCreatedByFromFullNameMetadata } from 'src/engine/core-modules/actor/utils/build-created-by-from-full-name-metadata.util';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { TestAiAgentDTO } from 'src/engine/core-modules/workflow/dtos/test-ai-agent.dto';
import { WorkflowAiAgentTestContextService } from 'src/engine/core-modules/workflow/services/workflow-ai-agent-test-context.service';
import { AgentAsyncExecutorService } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-async-executor.service';
import { AgentEntity } from 'src/engine/metadata-modules/ai/ai-agent/entities/agent.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

@Injectable()
export class WorkflowAiAgentTestService {
  constructor(
    private readonly agentAsyncExecutorService: AgentAsyncExecutorService,
    @InjectWorkspaceScopedRepository(AgentEntity)
    private readonly agentRepository: WorkspaceScopedRepository<AgentEntity>,
    private readonly workflowAiAgentTestContextService: WorkflowAiAgentTestContextService,
  ) {}

  async test({
    workspaceId,
    agentId,
    prompt,
    candidateId,
    workflowVersionId,
    stepId,
  }: {
    workspaceId: string;
    agentId: string;
    prompt: string;
    candidateId?: string;
    workflowVersionId?: string;
    stepId?: string;
  }): Promise<TestAiAgentDTO> {
    const startedAtMs = Date.now();

    try {
      const agent = await this.agentRepository.findOne(workspaceId, {
        where: { id: agentId },
      });

      if (!isDefined(agent)) {
        return this.buildFailure({
          message: `Agent with id ${agentId} not found`,
          startedAtMs,
        });
      }

      const userPrompt = await this.resolveUserPrompt({
        workspaceId,
        prompt,
        candidateId,
        workflowVersionId,
        stepId,
      });

      const authContext = getWorkspaceAuthContext();
      const userWorkspaceId = isUserAuthContext(authContext)
        ? authContext.userWorkspaceId
        : null;
      const actorContext = isUserAuthContext(authContext)
        ? buildCreatedByFromFullNameMetadata({
            fullNameMetadata: authContext.workspaceMember.name,
            workspaceMemberId: authContext.workspaceMemberId,
            source: FieldActorSource.MANUAL,
          })
        : undefined;

      const executionResult = await this.agentAsyncExecutorService.executeAgent(
        {
          agent,
          userPrompt,
          actorContext,
          authContext,
          workspaceId,
          userWorkspaceId,
          operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
        },
      );

      const durationMs = Date.now() - startedAtMs;

      if (executionResult.hasNoMoreAvailableCredits) {
        return {
          success: false,
          message: 'AI agent stopped: no more available credits.',
          result: null,
          error: 'AI agent stopped: no more available credits.',
          durationMs,
        };
      }

      return {
        success: true,
        message: 'AI agent test completed successfully',
        result: executionResult.result,
        error: undefined,
        durationMs,
      };
    } catch (error) {
      return this.buildFailure({
        message:
          error instanceof Error ? error.message : 'AI agent test failed',
        startedAtMs,
      });
    }
  }

  private async resolveUserPrompt({
    workspaceId,
    prompt,
    candidateId,
    workflowVersionId,
    stepId,
  }: {
    workspaceId: string;
    prompt: string;
    candidateId?: string;
    workflowVersionId?: string;
    stepId?: string;
  }): Promise<string> {
    if (!isNonEmptyString(candidateId)) {
      return prompt;
    }

    if (!isNonEmptyString(workflowVersionId) || !isNonEmptyString(stepId)) {
      throw new Error(
        'workflowVersionId and stepId are required when testing with a candidate',
      );
    }

    return this.workflowAiAgentTestContextService.resolvePromptForCandidate({
      workspaceId,
      workflowVersionId,
      stepId,
      candidateId,
      prompt,
    });
  }

  private buildFailure({
    message,
    startedAtMs,
  }: {
    message: string;
    startedAtMs: number;
  }): TestAiAgentDTO {
    return {
      success: false,
      message,
      result: null,
      error: message,
      durationMs: Date.now() - startedAtMs,
    };
  }
}
