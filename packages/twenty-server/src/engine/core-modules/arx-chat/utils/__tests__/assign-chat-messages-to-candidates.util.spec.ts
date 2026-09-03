import { type MessageNode } from 'twenty-shared';

import {
  assignChatMessagesToCandidates,
  chunkStrings,
} from '../assign-chat-messages-to-candidates.util';

const buildMessage = (
  overrides: Partial<MessageNode> & Pick<MessageNode, 'id'>,
): MessageNode =>
  ({
    recruiterId: '',
    message: 'hello',
    candidateId: '',
    projectsId: '',
    position: 1,
    messageType: '',
    phoneTo: '',
    updatedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    name: 'botMessage',
    phoneFrom: '',
    messageObj: [],
    whatsappDeliveryStatus: 'sent',
    ...overrides,
  }) as MessageNode;

describe('assignChatMessagesToCandidates', () => {
  it('chunks string ids', () => {
    expect(chunkStrings(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(chunkStrings([], 2)).toEqual([]);
  });

  it('attaches candidate and person messages and expands LinkedIn transcripts', () => {
    const candidates = [
      { id: 'cand-1', peopleId: 'person-1' },
      { id: 'cand-2', peopleId: 'person-2' },
    ];

    assignChatMessagesToCandidates(candidates, [
      buildMessage({
        id: 'linkedin-row',
        candidateId: 'cand-1',
        personId: 'person-1',
        name: 'LINKEDIN abc',
        typeOfMessage: 'linkedin',
        message: 'latest',
        messageObj: [
          {
            role: 'assistant',
            content: 'Hi — are you hiring?',
            timestamp: '2026-08-01T10:00:00.000Z',
          },
          {
            role: 'user',
            content: 'Yes, send a deck',
            timestamp: '2026-08-01T11:00:00.000Z',
          },
        ],
      }),
      buildMessage({
        id: 'person-only',
        candidateId: '',
        personId: 'person-2',
        message: 'Person-only ping',
        createdAt: '2026-08-02T00:00:00.000Z',
      }),
    ]);

    expect(candidates[0].chatMessages?.edges).toHaveLength(2);
    expect(
      candidates[0].chatMessages?.edges.map((edge) => edge.node.message),
    ).toEqual(['Hi — are you hiring?', 'Yes, send a deck']);
    expect(candidates[1].chatMessages?.edges).toHaveLength(1);
    expect(candidates[1].chatMessages?.edges[0]?.node.message).toBe(
      'Person-only ping',
    );
  });
});
