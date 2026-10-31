import { expandChatTranscriptRows } from '../expand-chat-transcript-turns.util';

const baseRow = {
  id: 'row-1',
  message: 'latest',
  name: 'LINKEDIN abcd1234',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  position: 1,
  whatsappDeliveryStatus: 'sent',
  typeOfMessage: 'linkedin',
  messageObj: [
    {
      role: 'assistant',
      content: 'Hi — are you hiring?',
      id: 'out-1',
      timestamp: '2026-08-01T10:00:00.000Z',
    },
    {
      role: 'user',
      content: 'Yes, send a deck',
      id: 'in-1',
      timestamp: '2026-08-01T11:00:00.000Z',
    },
  ],
};

describe('expandChatTranscriptRows', () => {
  it('expands GTM LinkedIn transcripts into sent and received bubbles', () => {
    const expanded = expandChatTranscriptRows([baseRow]);

    expect(expanded).toHaveLength(2);
    expect(expanded[0]).toMatchObject({
      id: 'out-1',
      message: 'Hi — are you hiring?',
      name: 'botMessage',
      position: 1,
    });
    expect(expanded[1]).toMatchObject({
      id: 'in-1',
      message: 'Yes, send a deck',
      name: 'candidateMessage',
      position: 2,
    });
  });

  it('expands email transcripts the same way so the drawer shows the whole thread', () => {
    const emailRow = {
      ...baseRow,
      id: 'email-row',
      name: 'EMAIL cand1234',
      typeOfMessage: 'email',
    };

    const expanded = expandChatTranscriptRows([emailRow]);

    expect(expanded.map((row) => row.message)).toEqual([
      'Hi — are you hiring?',
      'Yes, send a deck',
    ]);
    expect(expanded.map((row) => row.name)).toEqual([
      'botMessage',
      'candidateMessage',
    ]);
  });

  it('expands rows stored with the CRM channel enum as typeOfMessage', () => {
    const enumRows = [
      { ...baseRow, typeOfMessage: 'LINKEDIN_CONNECT' },
      { ...baseRow, typeOfMessage: 'EMAIL' },
    ];

    expect(expandChatTranscriptRows(enumRows)).toHaveLength(4);
  });

  it('leaves WhatsApp rows unchanged', () => {
    const whatsapp = {
      ...baseRow,
      typeOfMessage: 'whatsapp-unipile',
      name: 'botMessage',
      message: 'Hello',
      messageObj: [{ role: 'assistant', content: 'Hello' }],
    };

    expect(expandChatTranscriptRows([whatsapp])).toEqual([whatsapp]);
  });
});
