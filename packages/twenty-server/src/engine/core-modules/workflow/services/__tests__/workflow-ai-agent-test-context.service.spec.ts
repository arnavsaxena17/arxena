import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkflowAiAgentTestContextService } from 'src/engine/core-modules/workflow/services/workflow-ai-agent-test-context.service';
import { WorkflowActionType } from 'twenty-shared/workflow';

jest.mock(
  'src/engine/core-modules/auth/storage/workspace-auth-context.storage',
  () => ({
    getWorkspaceAuthContext: jest.fn(),
  }),
);

const getWorkspaceAuthContextMock = getWorkspaceAuthContext as jest.Mock;

describe('WorkflowAiAgentTestContextService', () => {
  const workspaceId = 'workspace-1';
  const workflowVersionId = 'version-1';
  const candidateId = '11111111-1111-4111-8111-111111111111';
  const memberId = '22222222-2222-4222-8222-222222222222';
  const loadCandidateStepId = '33333333-3333-4333-8333-333333333333';
  const fetchProfileStepId = '44444444-4444-4444-8444-444444444444';
  const draftStepId = '55555555-5555-4555-8555-555555555555';
  const logicFunctionId = '66666666-6666-4666-8666-666666666666';

  const candidate = {
    id: candidateId,
    name: 'Jane Doe',
    jobTitle: 'Head of Sales',
  };

  const userAuthContext = {
    type: 'user',
    workspace: { id: workspaceId },
    workspaceMemberId: memberId,
    workspaceMember: { id: memberId },
  } as unknown as WorkspaceAuthContext;

  let service: WorkflowAiAgentTestContextService;
  let workflowCommonWorkspaceService: { getWorkflowVersionOrFail: jest.Mock };
  let globalWorkspaceOrmManager: {
    executeInWorkspaceContext: jest.Mock;
    getRepository: jest.Mock;
  };
  let flatEntityMapsCacheService: {
    getOrRecomputeManyOrAllFlatEntityMaps: jest.Mock;
  };
  let nativeHandler: { isNative: jest.Mock; execute: jest.Mock };
  let nativeLogicFunctionRegistry: { find: jest.Mock };

  beforeEach(() => {
    workflowCommonWorkspaceService = {
      getWorkflowVersionOrFail: jest.fn(),
    };
    globalWorkspaceOrmManager = {
      executeInWorkspaceContext: jest.fn(
        async (callback: () => Promise<unknown>) => callback(),
      ),
      getRepository: jest.fn(),
    };
    flatEntityMapsCacheService = {
      getOrRecomputeManyOrAllFlatEntityMaps: jest.fn(),
    };
    nativeHandler = {
      isNative: jest.fn().mockReturnValue(true),
      execute: jest.fn(),
    };
    nativeLogicFunctionRegistry = {
      find: jest.fn().mockReturnValue(nativeHandler),
    };
    getWorkspaceAuthContextMock.mockReturnValue(userAuthContext);

    service = new WorkflowAiAgentTestContextService(
      workflowCommonWorkspaceService as never,
      globalWorkspaceOrmManager as never,
      flatEntityMapsCacheService as never,
      nativeLogicFunctionRegistry as never,
    );
  });

  it('should fetch candidate and previous native logic functions then fill chips', async () => {
    workflowCommonWorkspaceService.getWorkflowVersionOrFail.mockResolvedValue({
      id: workflowVersionId,
      steps: [
        {
          id: loadCandidateStepId,
          name: 'Load Candidate',
          type: WorkflowActionType.FIND_RECORDS,
          valid: true,
          nextStepIds: [fetchProfileStepId],
          settings: { input: { objectName: 'candidate' }, outputSchema: {} },
        },
        {
          id: fetchProfileStepId,
          name: 'Fetch LinkedIn profile',
          type: WorkflowActionType.LOGIC_FUNCTION,
          valid: true,
          nextStepIds: [draftStepId],
          settings: {
            input: {
              logicFunctionId,
              logicFunctionInput: {
                candidateId: `{{${loadCandidateStepId}.first.id}}`,
              },
            },
            outputSchema: {},
          },
        },
        {
          id: draftStepId,
          name: 'Draft first LinkedIn message',
          type: WorkflowActionType.AI_AGENT,
          valid: true,
          settings: { input: { prompt: '' }, outputSchema: {} },
        },
      ],
    });
    globalWorkspaceOrmManager.getRepository.mockResolvedValue({
      find: jest.fn().mockResolvedValue([candidate]),
    });
    flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps.mockResolvedValue(
      {
        flatLogicFunctionMaps: {
          universalIdentifierById: {
            [logicFunctionId]: logicFunctionId,
          },
          byUniversalIdentifier: {
            [logicFunctionId]: {
              id: logicFunctionId,
              name: 'fetch-linkedin-profile',
            },
          },
        },
      },
    );
    nativeHandler.execute.mockResolvedValue({
      success: true,
      about: 'B2B sales leader',
    });

    const resolvedPrompt = await service.resolvePromptForCandidate({
      workspaceId,
      workflowVersionId,
      stepId: draftStepId,
      candidateId,
      prompt: `Name: {{${loadCandidateStepId}.first.name}}\nAbout: {{${fetchProfileStepId}.about}}`,
    });

    expect(nativeHandler.execute).toHaveBeenCalledWith({
      name: 'fetch-linkedin-profile',
      workspaceId,
      payload: { candidateId },
      stepId: fetchProfileStepId,
    });
    expect(resolvedPrompt).toBe('Name: Jane Doe\nAbout: B2B sales leader');
  });

  it('should load prior chat messages for a reply prompt', async () => {
    const chatStepId = '77777777-7777-4777-8777-777777777777';
    const replyStepId = '88888888-8888-4888-8888-888888888888';
    const chatMessages = [{ id: 'msg-1', message: 'Can we talk Thursday?' }];
    const chatMessageFind = jest.fn().mockResolvedValue(chatMessages);
    const candidateFind = jest.fn().mockResolvedValue([candidate]);

    workflowCommonWorkspaceService.getWorkflowVersionOrFail.mockResolvedValue({
      id: workflowVersionId,
      steps: [
        {
          id: loadCandidateStepId,
          name: 'Load Candidate',
          type: WorkflowActionType.FIND_RECORDS,
          valid: true,
          nextStepIds: [chatStepId],
          settings: { input: { objectName: 'candidate' }, outputSchema: {} },
        },
        {
          id: chatStepId,
          name: 'Load inbound messages',
          type: WorkflowActionType.FIND_RECORDS,
          valid: true,
          nextStepIds: [replyStepId],
          settings: { input: { objectName: 'chatMessage' }, outputSchema: {} },
        },
        {
          id: replyStepId,
          name: 'Draft sales reply',
          type: WorkflowActionType.AI_AGENT,
          valid: true,
          settings: { input: { prompt: '' }, outputSchema: {} },
        },
      ],
    });
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) => {
        if (objectName === 'chatMessage') {
          return { find: chatMessageFind };
        }

        return { find: candidateFind };
      },
    );

    const resolvedPrompt = await service.resolvePromptForCandidate({
      workspaceId,
      workflowVersionId,
      stepId: replyStepId,
      candidateId,
      prompt: `Inbound: {{${chatStepId}.first.message}}`,
    });

    expect(chatMessageFind).toHaveBeenCalledWith({
      where: { candidateId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    expect(resolvedPrompt).toBe('Inbound: Can we talk Thursday?');
  });

  it('should throw when the candidate does not exist', async () => {
    workflowCommonWorkspaceService.getWorkflowVersionOrFail.mockResolvedValue({
      id: workflowVersionId,
      steps: [
        {
          id: draftStepId,
          name: 'Draft',
          type: WorkflowActionType.AI_AGENT,
          valid: true,
          settings: { input: { prompt: '' }, outputSchema: {} },
        },
      ],
    });
    globalWorkspaceOrmManager.getRepository.mockResolvedValue({
      find: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.resolvePromptForCandidate({
        workspaceId,
        workflowVersionId,
        stepId: draftStepId,
        candidateId,
        prompt: 'Hello',
      }),
    ).rejects.toThrow(`Candidate ${candidateId} was not found`);
  });
});
