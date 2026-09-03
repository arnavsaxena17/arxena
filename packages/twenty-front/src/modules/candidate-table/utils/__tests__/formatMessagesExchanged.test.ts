import { formatLastInboundMessage, formatMessagesExchanged } from '@/candidate-table/utils/formatMessagesExchanged';

describe('formatMessagesExchanged', () => {
  it('formats recruiter and candidate messages in chronological order', () => {
    const formatted = formatMessagesExchanged({
      edges: [
        {
          node: {
            name: 'candidateMessage',
            message: 'Yes, send a deck',
            createdAt: '2026-08-01T11:00:00.000Z',
          },
        },
        {
          node: {
            name: 'botMessage',
            message: 'Hi — are you hiring?',
            createdAt: '2026-08-01T10:00:00.000Z',
          },
        },
      ],
    });

    expect(formatted).toContain('Recruiter: Hi — are you hiring?');
    expect(formatted).toContain('Candidate: Yes, send a deck');
    expect(formatted.indexOf('Hi — are you hiring?')).toBeLessThan(
      formatted.indexOf('Yes, send a deck'),
    );
    expect(formatted).toMatch(/\[\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2}/);
    expect(formatted).not.toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it('expands unexpanded LinkedIn transcript rows', () => {
    const formatted = formatMessagesExchanged({
      edges: [
        {
          node: {
            name: 'LINKEDIN abc',
            message: 'latest',
            createdAt: '2026-08-01T00:00:00.000Z',
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
          },
        },
      ],
    });

    expect(formatted).toContain('Recruiter: Hi — are you hiring?');
    expect(formatted).toContain('Candidate: Yes, send a deck');
  });

  it('returns an empty string when there are no messages', () => {
    expect(formatMessagesExchanged({ edges: [] })).toBe('');
    expect(formatMessagesExchanged(undefined)).toBe('');
  });
});

describe('formatLastInboundMessage', () => {
  it('returns the latest candidate message only', () => {
    expect(
      formatLastInboundMessage({
        edges: [
          {
            node: {
              name: 'botMessage',
              message: 'Hi — are you hiring?',
              createdAt: '2026-08-01T10:00:00.000Z',
            },
          },
          {
            node: {
              name: 'candidateMessage',
              message: 'Yes, send a deck',
              createdAt: '2026-08-01T11:00:00.000Z',
            },
          },
          {
            node: {
              name: 'candidateMessage',
              message: 'Earlier reply',
              createdAt: '2026-08-01T09:00:00.000Z',
            },
          },
        ],
      }),
    ).toBe('Yes, send a deck');
  });
});
