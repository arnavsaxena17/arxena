import { FieldActorSource } from 'twenty-shared/types';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { UsageOperationType } from 'src/engine/core-modules/usage/enums/usage-operation-type.enum';
import { WorkflowAiAgentTestService } from 'src/engine/core-modules/workflow/services/workflow-ai-agent-test.service';
import { type AgentAsyncExecutorService } from 'src/engine/metadata-modules/ai/ai-agent-execution/services/agent-async-executor.service';
import { type AgentEntity } from 'src/engine/metadata-modules/ai/ai-agent/entities/agent.entity';
import { type WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({
    getWorkspaceAuthContext: jest.fn(),
  }),
);

const getWorkspaceAuthContextMock = getWorkspaceAuthContext as jest.Mock;

describe('WorkflowAiAgentTestService', () => {
  const workspaceId = 'workspace-1';
  const agentId = 'agent-1';
  const prompt = 'Summarize {{trigger.record.name}}';

  let agentRepository: { findOne: jest.Mock };
  let agentAsyncExecutorService: { executeAgent: jest.Mock };
  let service: WorkflowAiAgentTestService;

  const agent = {
    id: agentId,
    workspaceId,
    name: 'test-agent',
  } as AgentEntity;

  const userAuthContext = {
    type: 'user',
    workspace: { id: workspaceId },
    userWorkspaceId: 'user-workspace-1',
    user: { id: 'user-1' },
    workspaceMemberId: 'member-1',
    workspaceMember: {
      id: 'member-1',
      name: { firstName: 'Ada', lastName: 'Lovelace' },
    },
  } as unknown as WorkspaceAuthContext;

  beforeEach(() => {
    agentRepository = { findOne: jest.fn() };
    agentAsyncExecutorService = { executeAgent: jest.fn() };
    getWorkspaceAuthContextMock.mockReturnValue(userAuthContext);

    service = new WorkflowAiAgentTestService(
      agentAsyncExecutorService as unknown as AgentAsyncExecutorService,
      agentRepository as unknown as WorkspaceScopedRepository<AgentEntity>,
    );
  });

  it('runs the agent and returns the result', async () => {
    agentRepository.findOne.mockResolvedValue(agent);
    agentAsyncExecutorService.executeAgent.mockResolvedValue({
      result: { summary: 'ok' },
      hasNoMoreAvailableCredits: false,
    });

    const response = await service.test({ workspaceId, agentId, prompt });

    expect(agentAsyncExecutorService.executeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agent,
        userPrompt: prompt,
        workspaceId,
        userWorkspaceId: 'user-workspace-1',
        operationType: UsageOperationType.AI_WORKFLOW_TOKEN,
        actorContext: expect.objectContaining({
          source: FieldActorSource.MANUAL,
          workspaceMemberId: 'member-1',
          name: 'Ada Lovelace',
        }),
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        success: true,
        message: 'AI agent test completed successfully',
        result: { summary: 'ok' },
        error: undefined,
      }),
    );
    expect(response.durationMs).toEqual(expect.any(Number));
  });

  it('returns an error when the agent is missing', async () => {
    agentRepository.findOne.mockResolvedValue(null);

    const response = await service.test({ workspaceId, agentId, prompt });

    expect(agentAsyncExecutorService.executeAgent).not.toHaveBeenCalled();
    expect(response.success).toBe(false);
    expect(response.error).toBe(`Agent with id ${agentId} not found`);
  });

  it('returns an error when credits are exhausted', async () => {
    agentRepository.findOne.mockResolvedValue(agent);
    agentAsyncExecutorService.executeAgent.mockResolvedValue({
      result: {},
      hasNoMoreAvailableCredits: true,
    });

    const response = await service.test({ workspaceId, agentId, prompt });

    expect(response.success).toBe(false);
    expect(response.error).toBe(
      'AI agent stopped: no more available credits.',
    );
  });

  it('returns an error when execution throws', async () => {
    agentRepository.findOne.mockResolvedValue(agent);
    agentAsyncExecutorService.executeAgent.mockRejectedValue(
      new Error('model unavailable'),
    );

    const response = await service.test({ workspaceId, agentId, prompt });

    expect(response.success).toBe(false);
    expect(response.error).toBe('model unavailable');
  });
});
