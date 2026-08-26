import { MessagingChannel } from 'twenty-shared/arx';

import { GtmOutreachMessagePersistService } from '../gtm-outreach-message-persist.service';

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
