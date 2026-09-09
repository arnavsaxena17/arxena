import { type ObjectRecordCreateEvent } from 'twenty-shared/database-events';
import { MessageParticipantRole } from 'twenty-shared/types';

import { OutreachInboundEmailListener } from 'src/engine/core-modules/outreach-command/listeners/outreach-inbound-email.listener';
import { MessageDirection } from 'src/modules/messaging/common/enums/message-direction.enum';
import { type WorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/workspace-event-batch.type';

describe('OutreachInboundEmailListener', () => {
  const messageRepository = { find: jest.fn() };
  const participantRepository = { find: jest.fn() };
  const persistService = {
    findOutreachCandidateForInboundEmail: jest.fn(),
  };
  const inboundWindowService = { schedule: jest.fn() };
  const authTokenService = { resolveOrMint: jest.fn() };
  const globalWorkspaceOrmManager = {
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) =>
      objectName === 'message' ? messageRepository : participantRepository,
    ),
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
  };

  const listener = new OutreachInboundEmailListener(
    globalWorkspaceOrmManager as never,
    persistService as never,
    inboundWindowService as never,
    authTokenService as never,
  );

  const buildPayload = (
    direction: string,
    messageId = 'msg-1',
  ): WorkspaceEventBatch<
    ObjectRecordCreateEvent<{
      messageId?: string | null;
      direction?: string | null;
    }>
  > =>
    ({
      name: 'messageChannelMessageAssociation.created',
      workspaceId: 'ws-1',
      objectMetadata: {} as never,
      events: [
        {
          recordId: 'assoc-1',
          properties: {
            after: { messageId, direction },
          },
        },
      ],
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepository.find.mockResolvedValue([
      {
        id: 'msg-1',
        subject: 'Re: intro',
        text: 'Saturday 11am works',
        headerMessageId: '<msg-1@mail>',
        receivedAt: '2026-09-08T11:00:00.000Z',
      },
    ]);
    participantRepository.find.mockResolvedValue([
      {
        messageId: 'msg-1',
        role: MessageParticipantRole.FROM,
        handle: 'alex@acme.com',
        personId: 'person-1',
      },
    ]);
    persistService.findOutreachCandidateForInboundEmail.mockResolvedValue({
      candidateId: 'cand-1',
      delayMinutes: 2,
    });
    authTokenService.resolveOrMint.mockResolvedValue('api-token');
    inboundWindowService.schedule.mockResolvedValue(undefined);
    globalWorkspaceOrmManager.executeInWorkspaceContext.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
  });

  it('schedules an EMAIL outreach inbound flush for incoming mail', async () => {
    await listener.handleIncomingEmailAssociationCreated(
      buildPayload(MessageDirection.INCOMING),
    );

    expect(
      persistService.findOutreachCandidateForInboundEmail,
    ).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      fromEmail: 'alex@acme.com',
      personId: 'person-1',
    });
    expect(inboundWindowService.schedule).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      candidateId: 'cand-1',
      delayMinutes: 2,
      apiToken: 'api-token',
      kind: 'outreach',
      channel: 'EMAIL',
      turn: {
        role: 'user',
        content: 'Re: intro\n\nSaturday 11am works',
        externalMessageId: '<msg-1@mail>',
        receivedAt: '2026-09-08T11:00:00.000Z',
      },
    });
  });

  it('ignores outgoing associations', async () => {
    await listener.handleIncomingEmailAssociationCreated(
      buildPayload(MessageDirection.OUTGOING),
    );

    expect(messageRepository.find).not.toHaveBeenCalled();
    expect(inboundWindowService.schedule).not.toHaveBeenCalled();
  });
});
