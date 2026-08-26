import { MessagingChannel } from 'twenty-shared/arx';
import { FieldActorSource } from 'twenty-shared/types';

import { GtmOutreachMessagePersistService } from '../gtm-outreach-message-persist.service';

const SYSTEM_ACTOR = {
  source: FieldActorSource.SYSTEM,
  name: 'System',
  workspaceMemberId: null,
  context: {},
};

describe('GtmOutreachMessagePersistService.materializeCandidateEvent', () => {
  const applyCandidateEvent = jest.fn();
  const resolveOrMint = jest.fn();
  const candidateRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async () => candidateRepository),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const service = new GtmOutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveOrMint.mockResolvedValue('api-token');
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      firstOutboundAt: null,
    });
    globalWorkspaceOrmManager.getRepository.mockResolvedValue(
      candidateRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('stamps connection_sent without overwriting an existing firstOutboundAt', async () => {
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      firstOutboundAt: '2026-08-01T00:00:00.000Z',
    });

    await service.materializeCandidateEvent({
      workspaceId: 'ws-1',
      event: 'connection_sent',
      candidateId: 'cand-1',
      messagingChannel: MessagingChannel.LINKEDIN_CONNECT,
    });

    expect(applyCandidateEvent).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      event: 'connection_sent',
      apiToken: 'api-token',
      messagingChannel: MessagingChannel.LINKEDIN_CONNECT,
      existingFirstOutboundAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('passes a null firstOutboundAt so the first send is stamped', async () => {
    await service.materializeCandidateEvent({
      workspaceId: 'ws-1',
      event: 'connection_sent',
      candidateId: 'cand-1',
      messagingChannel: MessagingChannel.LINKEDIN_CONNECT,
    });

    expect(applyCandidateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        candidateId: 'cand-1',
        event: 'connection_sent',
        existingFirstOutboundAt: null,
      }),
    );
  });
});

describe('GtmOutreachMessagePersistService.mergeFetchedLinkedinMessages', () => {
  const applyCandidateEvent = jest.fn();
  const resolveOrMint = jest.fn();
  const candidateRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const messageRepository = {
    find: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) =>
      objectName === 'chatMessage' ? messageRepository : candidateRepository,
    ),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const service = new GtmOutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue({
      id: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
      peopleId: 'person-1',
      projectsId: 'project-1',
    });
    messageRepository.find.mockResolvedValue([]);
    messageRepository.save.mockResolvedValue({});
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'chatMessage' ? messageRepository : candidateRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('stamps system createdBy/updatedBy when inserting a new chat message', async () => {
    await service.mergeFetchedLinkedinMessages({
      workspaceId: 'ws-1',
      candidateId: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
      chatId: 'AmEepVtWUB6M-9L6BqUsAA',
      messages: [
        {
          id: '2kuKnBpZWZCaaV8MpRN_Zg',
          text: 'Happy to connect — would love to share how we help GTM teams.',
          timestamp: '2026-08-25T21:18:24.338Z',
          isSender: true,
        },
      ],
    });

    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'LINKEDIN 993fcd9e',
        createdBy: SYSTEM_ACTOR,
        updatedBy: SYSTEM_ACTOR,
        channel: 'LINKEDIN',
        externalChatId: 'AmEepVtWUB6M-9L6BqUsAA',
        externalMessageId: '2kuKnBpZWZCaaV8MpRN_Zg',
        candidateId: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
      }),
    );
    expect(messageRepository.save).toHaveBeenCalledTimes(1);
    expect(messageRepository.update).not.toHaveBeenCalled();
  });

  it('updates an existing chat message without rewriting actor fields', async () => {
    messageRepository.find.mockResolvedValue([
      {
        id: 'existing-row',
        candidateId: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
        channel: 'LINKEDIN',
        messageObj: [],
      },
    ]);

    await service.mergeFetchedLinkedinMessages({
      workspaceId: 'ws-1',
      candidateId: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
      messages: [
        {
          id: 'msg-2',
          text: 'Thanks for connecting.',
          timestamp: '2026-08-26T10:00:00.000Z',
          isSender: false,
        },
      ],
    });

    expect(messageRepository.update).toHaveBeenCalledWith(
      'existing-row',
      expect.objectContaining({
        candidateId: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
        channel: 'LINKEDIN',
      }),
    );
    expect(messageRepository.save).not.toHaveBeenCalled();
  });
});
