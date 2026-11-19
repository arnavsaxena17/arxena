import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type BrowsingContextType } from 'src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import { AgentChatStreamingService } from 'src/engine/metadata-modules/ai/ai-chat/services/agent-chat-streaming.service';

describe('AgentChatStreamingService browsing context', () => {
  const workspace = { id: 'workspace-id' } as WorkspaceEntity;

  const outreachContext: BrowsingContextType = {
    type: 'outreachCommand',
    projectId: '22fd225f-edc8-4e57-8bd1-e8e2b52f4210',
    projectName: 'Nephrologists in Mumbai',
    outreachWorkflowId: null,
    outreachSendMode: 'APPROVAL',
    phase: 'live',
    activeTab: 'people',
    selectedCompanyId: null,
    selectedPersonId: null,
    icpName: null,
    icpSpecSummary: null,
    linkedinConnected: true,
    gmailConnected: true,
    whatsappConnected: false,
  };

  const baseThread = {
    id: 'thread-id',
    title: 'Thread',
    conversationSize: 0,
    activeStreamId: null,
    lastStreamError: null,
    pendingQuestionMessageId: null as string | null,
    lastBrowsingContext: null as BrowsingContextType | null,
  };

  const buildService = (thread = baseThread) => {
    const threadRepository = {
      findOne: jest.fn().mockResolvedValue(thread),
      findOneOrFail: jest.fn().mockResolvedValue(thread),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const messageQueueService = { add: jest.fn().mockResolvedValue(undefined) };
    const agentChatService = {
      addMessage: jest
        .fn()
        .mockResolvedValue({ id: 'user-message-id', turnId: 'turn-id' }),
      notifyThreadActivityUpdated: jest.fn().mockResolvedValue(undefined),
      getMessagesForThread: jest.fn().mockResolvedValue([]),
      hasQueuedMessages: jest.fn().mockResolvedValue(false),
      resolvePendingQuestion: jest.fn().mockResolvedValue({
        turnId: 'turn-id',
        rollback: { partId: 'part-id', previousOutput: {} },
      }),
      restorePendingQuestion: jest.fn().mockResolvedValue(undefined),
    };
    const streamHeartbeatService = {
      markClaimed: jest.fn().mockResolvedValue(undefined),
      isAlive: jest.fn().mockResolvedValue(true),
      clear: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AgentChatStreamingService(
      threadRepository as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      messageQueueService as never,
      agentChatService as never,
      {
        publish: jest.fn().mockResolvedValue(undefined),
        resetStreamState: jest.fn().mockResolvedValue(undefined),
      } as never,
      { signFileByIdUrl: jest.fn() } as never,
      streamHeartbeatService as never,
      { incrementCounterBy: jest.fn() } as never,
    );

    return { service, threadRepository, messageQueueService };
  };

  const enqueuedBrowsingContext = (
    messageQueueService: ReturnType<typeof buildService>['messageQueueService'],
  ) => messageQueueService.add.mock.calls[0][1].browsingContext;

  it('should save the browsing context on the thread when a new message carries one', async () => {
    const { service, threadRepository, messageQueueService } = buildService();

    await service.streamAgentChat({
      threadId: 'thread-id',
      userWorkspaceId: 'user-workspace-id',
      workspace,
      text: 'Make a list of the nephrologists of top hospitals in Mumbai',
      browsingContext: outreachContext,
    });

    expect(threadRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'thread-id' },
      { lastBrowsingContext: outreachContext },
    );
    expect(enqueuedBrowsingContext(messageQueueService)).toEqual(
      outreachContext,
    );
  });

  it('should not rewrite the thread when the browsing context is unchanged', async () => {
    const { service, threadRepository } = buildService({
      ...baseThread,
      lastBrowsingContext: outreachContext,
    });

    await service.streamAgentChat({
      threadId: 'thread-id',
      userWorkspaceId: 'user-workspace-id',
      workspace,
      text: 'hello',
      browsingContext: { ...outreachContext },
    });

    expect(threadRepository.update).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ lastBrowsingContext: expect.anything() }),
    );
  });

  it('should clear the saved context when a new message carries none', async () => {
    const { service, threadRepository } = buildService({
      ...baseThread,
      lastBrowsingContext: outreachContext,
    });

    await service.streamAgentChat({
      threadId: 'thread-id',
      userWorkspaceId: 'user-workspace-id',
      workspace,
      text: 'hello',
      browsingContext: null,
    });

    expect(threadRepository.update).toHaveBeenCalledWith(
      'workspace-id',
      { id: 'thread-id' },
      { lastBrowsingContext: null },
    );
  });

  it('should resume an answered question with the saved browsing context', async () => {
    const { service, messageQueueService } = buildService({
      ...baseThread,
      pendingQuestionMessageId: 'question-message-id',
      lastBrowsingContext: outreachContext,
    });

    await service.answerPendingQuestionAndResumeStream({
      threadId: 'thread-id',
      messageId: 'question-message-id',
      answers: [{ questionIndex: 0, selectedOptionIndices: [0] }],
      userWorkspaceId: 'user-workspace-id',
      workspace,
    });

    expect(messageQueueService.add).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        isResume: true,
        browsingContext: outreachContext,
      }),
    );
  });

  it('should resume with no browsing context when the thread never had one', async () => {
    const { service, messageQueueService } = buildService({
      ...baseThread,
      pendingQuestionMessageId: 'question-message-id',
    });

    await service.answerPendingQuestionAndResumeStream({
      threadId: 'thread-id',
      messageId: 'question-message-id',
      answers: [{ questionIndex: 0, selectedOptionIndices: [0] }],
      userWorkspaceId: 'user-workspace-id',
      workspace,
    });

    expect(enqueuedBrowsingContext(messageQueueService)).toBeNull();
  });
});
