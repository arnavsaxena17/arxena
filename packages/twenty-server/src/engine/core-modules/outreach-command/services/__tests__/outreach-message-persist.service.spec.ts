import { MessagingChannel } from 'twenty-shared/arx';
import { FieldActorSource } from 'twenty-shared/types';

import { OutreachMessagePersistService } from '../outreach-message-persist.service';

const SYSTEM_ACTOR = {
  source: FieldActorSource.SYSTEM,
  name: 'System',
  workspaceMemberId: null,
  context: {},
};

describe('OutreachMessagePersistService.materializeCandidateEvent', () => {
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

  const service = new OutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveOrMint.mockResolvedValue('api-token');
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      outreachAnalytics: null,
    });
    globalWorkspaceOrmManager.getRepository.mockResolvedValue(
      candidateRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('passes existing analytics message kinds without overwriting them', async () => {
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      outreachAnalytics: {
        lastOutboundMessageKind: 'CONNECTION',
        convertedOnMessageKind: 'FOLLOW_UP',
      },
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
      existingConvertedOnMessageKind: 'FOLLOW_UP',
      existingLastOutboundMessageKind: 'CONNECTION',
    });
  });

  it('passes null analytics message kinds so the first send is stamped', async () => {
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
        existingConvertedOnMessageKind: undefined,
        existingLastOutboundMessageKind: undefined,
      }),
    );
  });
});

describe('OutreachMessagePersistService.mergeFetchedLinkedinMessages', () => {
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

  const service = new OutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue({
      id: '993fcd9e-891d-413a-8a22-9342d8d2f15b',
      peopleId: 'person-1',
      projectId: 'project-1',
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
          text: 'Happy to connect.',
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
        messageObj: [
          {
            role: 'assistant',
            content: 'Happy to connect.',
            id: '2kuKnBpZWZCaaV8MpRN_Zg',
            timestamp: '2026-08-25T21:18:24.338Z',
          },
        ],
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

describe('OutreachMessagePersistService.readLinkedinTranscriptMessages', () => {
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

  const service = new OutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      linkedinProfileId: 'divyesh-shah-b1b97698',
    });
    messageRepository.find.mockResolvedValue([
      {
        id: 'msg-row-1',
        candidateId: 'cand-1',
        channel: 'LINKEDIN',
        externalChatId: 'mock-chat-divyesh',
        messageObj: [
          {
            role: 'assistant',
            content: 'Hi Divyesh',
            id: 'out-1',
            timestamp: '2026-09-01T00:00:00.000Z',
          },
          {
            role: 'user',
            content: 'Thanks',
            id: 'in-1',
            timestamp: '2026-09-01T01:00:00.000Z',
          },
        ],
      },
    ]);
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'chatMessage' ? messageRepository : candidateRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('maps LINKEDIN chatMessage.messageObj turns into fetch output shape', async () => {
    await expect(
      service.readLinkedinTranscriptMessages({
        workspaceId: 'ws-1',
        linkedinProfileId: 'divyesh-shah-b1b97698',
      }),
    ).resolves.toEqual({
      candidateId: 'cand-1',
      chatId: 'mock-chat-divyesh',
      messages: [
        {
          id: 'out-1',
          text: 'Hi Divyesh',
          timestamp: '2026-09-01T00:00:00.000Z',
          senderId: '',
          isSender: true,
        },
        {
          id: 'in-1',
          text: 'Thanks',
          timestamp: '2026-09-01T01:00:00.000Z',
          senderId: '',
          isSender: false,
        },
      ],
    });
  });
});

describe('OutreachMessagePersistService.persistInboundFlush', () => {
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

  const service = new OutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.findOne.mockResolvedValue({
      id: 'cand-1',
      peopleId: 'person-1',
      projectId: 'project-1',
    });
    messageRepository.save.mockResolvedValue({});
    globalWorkspaceOrmManager.getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) =>
        objectName === 'chatMessage' ? messageRepository : candidateRepository,
    );
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('writes EMAIL inbound onto a new row instead of the LinkedIn transcript', async () => {
    messageRepository.find.mockResolvedValue([
      {
        id: 'linkedin-row',
        candidateId: 'cand-1',
        channel: 'LINKEDIN',
        typeOfMessage: 'linkedin',
        messageObj: [{ role: 'assistant', content: 'Hi' }],
      },
    ]);

    await service.persistInboundFlush({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      channel: 'EMAIL',
      turns: [
        {
          role: 'user',
          content: 'Please email me the deck',
          id: 'email-1',
        },
      ],
    });

    expect(messageRepository.update).not.toHaveBeenCalled();
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'EMAIL',
        typeOfMessage: 'email',
        candidateId: 'cand-1',
      }),
    );
  });

  it('resolves a candidate whose stored phone omits the calling code', async () => {
    messageRepository.find.mockResolvedValue([]);
    candidateRepository.find.mockResolvedValueOnce([
      { id: 'cand-1', phoneNumber: { primaryPhoneNumber: '9820976134' } },
    ]);

    await service.appendOutbound({
      workspaceId: 'ws-1',
      channel: 'WHATSAPP',
      body: 'Hi there',
      phone: '+919820976134',
      materializeOutbound: false,
    });

    expect(candidateRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phoneNumberPrimaryPhoneNumber: expect.anything() },
      }),
    );
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 'cand-1' }),
    );
  });

  it('falls back to the person phones column when candidate.phoneNumber is empty', async () => {
    messageRepository.find.mockResolvedValue([]);
    candidateRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'person-1', phones: { primaryPhoneNumber: '9820976134' } },
      ])
      .mockResolvedValueOnce([{ id: 'cand-1' }]);

    await service.appendOutbound({
      workspaceId: 'ws-1',
      channel: 'WHATSAPP',
      body: 'Hi there',
      phone: '+919820976134',
      materializeOutbound: false,
    });

    expect(candidateRepository.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { phonesPrimaryPhoneNumber: expect.anything() },
      }),
    );
    expect(messageRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: 'cand-1' }),
    );
  });

  it('does not resolve a candidate when no phone matches', async () => {
    messageRepository.find.mockResolvedValue([]);
    candidateRepository.find.mockResolvedValue([]);

    await service.appendOutbound({
      workspaceId: 'ws-1',
      channel: 'WHATSAPP',
      body: 'Hi there',
      phone: '+919820976134',
      materializeOutbound: false,
    });

    expect(messageRepository.save).not.toHaveBeenCalled();
  });
});

describe('OutreachMessagePersistService.findOutreachCandidateForInboundEmail', () => {
  const applyCandidateEvent = jest.fn();
  const resolveOrMint = jest.fn();
  const candidateRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const projectRepository = {
    findOne: jest.fn(),
  };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) => {
      if (objectName === 'project') {
        return projectRepository;
      }

      return candidateRepository;
    }),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const service = new OutreachMessagePersistService(
    globalWorkspaceOrmManager as never,
    { applyCandidateEvent } as never,
    { resolveOrMint } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    candidateRepository.find.mockResolvedValue([]);
    projectRepository.findOne.mockResolvedValue({
      id: 'project-1',
      engagementProcessingDelayMinutes: 3,
    });
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('returns the outreach candidate matched by email', async () => {
    candidateRepository.findOne
      .mockResolvedValueOnce({
        id: 'cand-1',
        emailPrimaryEmail: 'alex@acme.com',
      })
      .mockResolvedValueOnce({
        id: 'cand-1',
        outreachSequenceStage: 'WAITING_REPLY',
        projectId: 'project-1',
      });

    await expect(
      service.findOutreachCandidateForInboundEmail({
        workspaceId: 'ws-1',
        fromEmail: 'alex@acme.com',
      }),
    ).resolves.toEqual({
      candidateId: 'cand-1',
      delayMinutes: 3,
    });
  });

  it('falls back to the person emails column when candidate.email is empty', async () => {
    candidateRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'person-1' })
      .mockResolvedValueOnce({
        id: 'cand-1',
        outreachSequenceStage: 'WAITING_REPLY',
        projectId: 'project-1',
      });
    candidateRepository.find.mockResolvedValueOnce([{ id: 'cand-1' }]);

    await expect(
      service.findOutreachCandidateForInboundEmail({
        workspaceId: 'ws-1',
        fromEmail: 'alex@acme.com',
      }),
    ).resolves.toEqual({
      candidateId: 'cand-1',
      delayMinutes: 3,
    });
  });

  it('skips STOPPED outreach candidates', async () => {
    candidateRepository.findOne
      .mockResolvedValueOnce({
        id: 'cand-1',
        emailPrimaryEmail: 'alex@acme.com',
      })
      .mockResolvedValueOnce({
        id: 'cand-1',
        outreachSequenceStage: 'STOPPED',
        projectId: 'project-1',
      });

    await expect(
      service.findOutreachCandidateForInboundEmail({
        workspaceId: 'ws-1',
        fromEmail: 'alex@acme.com',
      }),
    ).resolves.toBeNull();
  });
});
