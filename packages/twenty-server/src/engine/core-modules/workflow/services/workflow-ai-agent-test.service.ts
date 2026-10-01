import { Injectable, Logger } from '@nestjs/common';

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
import { buildWorkflowAgentSystemPrompt } from 'src/engine/metadata-modules/ai/ai-agent/constants/agent-system-prompts.const';
import { AgentEntity } from 'src/engine/metadata-modules/ai/ai-agent/entities/agent.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { AiAgentOutputValidationService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/services/ai-agent-output-validation.service';
import { formatOutputValidationError } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-agent/utils/ai-agent-output-validation.util';

@Injectable()
export class WorkflowAiAgentTestService {
  private readonly logger = new Logger(WorkflowAiAgentTestService.name);

  constructor(
    private readonly agentAsyncExecutorService: AgentAsyncExecutorService,
    @InjectWorkspaceScopedRepository(AgentEntity)
    private readonly agentRepository: WorkspaceScopedRepository<AgentEntity>,
    private readonly workflowAiAgentTestContextService: WorkflowAiAgentTestContextService,
    private readonly aiAgentOutputValidationService: AiAgentOutputValidationService,
  ) {}

  async test({
    workspaceId,
    agentId,
    prompt,
    candidateId,
    workflowVersionId,
    stepId,
    outputValidation,
  }: {
    workspaceId: string;
    agentId: string;
    prompt: string;
    candidateId?: string;
    workflowVersionId?: string;
    stepId?: string;
    outputValidation?: {
      enabled: boolean;
      fieldKeys: string[];
      checks?: Array<{
        id: string;
        label: string;
        instructions: string;
        invalidWhen: string;
        validWhen: string;
      }>;
    };
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

      // Tool strategy is appended in AgentAsyncExecutorService when tools resolve non-empty
      const systemPrompt = buildWorkflowAgentSystemPrompt({
        agentPrompt: agent.prompt,
        hasTools: false,
      });

      this.logger.log(
        `[AI_AGENT_TEST] systemPrompt agentId=${agentId} stepId=${stepId ?? 'n/a'}\n${systemPrompt}`,
      );
      this.logger.log(
        `[AI_AGENT_TEST] prompt agentId=${agentId} stepId=${stepId ?? 'n/a'}\n${userPrompt}`,
      );

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

      const executeAgent = (promptForAttempt: string) =>
        this.agentAsyncExecutorService.executeAgent({
          agent,
          userPrompt: promptForAttempt,
          actorContext,
          authContext,
          workspaceId,
          userWorkspaceId,
          operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
        });
      const shouldValidate =
        outputValidation?.enabled === true &&
        outputValidation.fieldKeys.length > 0;
      const validatedRun = shouldValidate
        ? await this.aiAgentOutputValidationService.runWithRetries({
            userPrompt,
            fieldKeys: outputValidation.fieldKeys,
            checks: outputValidation.checks,
            execute: executeAgent,
          })
        : undefined;
      const executionResult =
        validatedRun?.executionResult ?? (await executeAgent(userPrompt));

      const durationMs = Date.now() - startedAtMs;

      this.logger.log(
        `[AI_AGENT_TEST] response agentId=${agentId} stepId=${stepId ?? 'n/a'} ` +
          `durationMs=${durationMs} hasNoMoreAvailableCredits=${executionResult.hasNoMoreAvailableCredits}\n` +
          `${JSON.stringify(executionResult.result, null, 2)}`,
      );

      if (executionResult.hasNoMoreAvailableCredits) {
        return {
          success: false,
          message: 'AI agent stopped: no more available credits.',
          result: null,
          error: 'AI agent stopped: no more available credits.',
          durationMs,
          outputValidation: validatedRun?.report,
        };
      }

      if (validatedRun && validatedRun.report.cleared === false) {
        const message = formatOutputValidationError(validatedRun.report);

        return {
          success: false,
          message,
          result: executionResult.result,
          error: message,
          durationMs,
          outputValidation: validatedRun.report,
        };
      }

      return {
        success: true,
        message: 'AI agent test completed successfully',
        result: executionResult.result,
        error: undefined,
        durationMs,
        outputValidation: validatedRun?.report,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI agent test failed';

      this.logger.warn(
        `[AI_AGENT_TEST] failed agentId=${agentId} stepId=${stepId ?? 'n/a'}: ${message}`,
      );

      return this.buildFailure({
        message,
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
