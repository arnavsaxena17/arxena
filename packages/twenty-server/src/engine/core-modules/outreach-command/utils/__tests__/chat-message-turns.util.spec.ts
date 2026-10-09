import {
  asChatTurns,
  foldTimestampedIntoMessageObj,
  mergeChatTurns,
} from 'src/engine/core-modules/outreach-command/utils/chat-message-turns.util';

describe('chat-message-turns.util', () => {
  it('parses role/content/id/timestamp turns and skips empty content', () => {
    expect(
      asChatTurns([
        {
          role: 'assistant',
          content: 'Hi',
          id: 'out-1',
          timestamp: '2026-09-01T00:00:00.000Z',
        },
        { role: 'user', message: 'Thanks' },
        { role: 'user', content: '' },
        'ignore',
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Hi',
        id: 'out-1',
        timestamp: '2026-09-01T00:00:00.000Z',
      },
      {
        role: 'user',
        content: 'Thanks',
      },
    ]);
  });

  it('maps Unipile text/isSender messages into assistant/user turns', () => {
    expect(
      asChatTurns([
        {
          id: 'inbound-1',
          text: 'Thanks, I am interested.',
          isSender: false,
          timestamp: '2026-09-09T14:25:29.886Z',
        },
        { text: 'Glad to hear it.', isSender: true },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: 'Thanks, I am interested.',
        id: 'inbound-1',
        timestamp: '2026-09-09T14:25:29.886Z',
      },
      {
        role: 'assistant',
        content: 'Glad to hear it.',
      },
    ]);
  });

  it('appends incoming turns that are not already present', () => {
    expect(
      mergeChatTurns(
        [{ role: 'assistant', content: 'Hi', id: 'out-1' }],
        [
          { role: 'assistant', content: 'Hi', id: 'out-1' },
          { role: 'user', content: 'Thanks', id: 'in-1' },
        ],
      ),
    ).toEqual([
      { role: 'assistant', content: 'Hi', id: 'out-1' },
      { role: 'user', content: 'Thanks', id: 'in-1' },
    ]);
  });

  // Same mock Unipile response id across sends would drop the second outbound.
  it('keeps distinct contents when turn ids differ', () => {
    expect(
      mergeChatTurns(
        [
          {
            role: 'assistant',
            content: 'Opener',
            id: 'mock-linkedin-message-1',
          },
        ],
        [
          {
            role: 'assistant',
            content: 'Thursday works — noon?',
            id: 'mock-linkedin-message-2',
          },
        ],
      ),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Opener',
        id: 'mock-linkedin-message-1',
      },
      {
        role: 'assistant',
        content: 'Thursday works — noon?',
        id: 'mock-linkedin-message-2',
      },
    ]);
  });

  it('drops a later outbound that reuses an earlier turn id', () => {
    expect(
      mergeChatTurns(
        [
          {
            role: 'assistant',
            content: 'Opener',
            id: 'mock-linkedin-message',
          },
        ],
        [
          {
            role: 'assistant',
            content: 'Thursday works — noon?',
            id: 'mock-linkedin-message',
          },
        ],
      ),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Opener',
        id: 'mock-linkedin-message',
      },
    ]);
  });

  it('treats the same role and content as a duplicate even when only one side has an id', () => {
    expect(
      mergeChatTurns(
        [
          {
            role: 'assistant',
            content: 'Hi',
            id: 'out-1',
            timestamp: '2026-09-01T00:00:00.000Z',
          },
        ],
        [{ role: 'assistant', content: 'Hi' }],
      ),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Hi',
        id: 'out-1',
        timestamp: '2026-09-01T00:00:00.000Z',
      },
    ]);
  });

  it('keeps timestamped turns and appends messageObj-only turns', () => {
    expect(
      foldTimestampedIntoMessageObj(
        [
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'Only in messageObj' },
        ],
        [
          {
            role: 'assistant',
            content: 'Hi',
            id: 'out-1',
            timestamp: '2026-09-01T00:00:00.000Z',
          },
        ],
      ),
    ).toEqual([
      {
        role: 'assistant',
        content: 'Hi',
        id: 'out-1',
        timestamp: '2026-09-01T00:00:00.000Z',
      },
      { role: 'user', content: 'Only in messageObj' },
    ]);
  });

  it('returns messageObj turns when the timestamped column is empty', () => {
    expect(
      foldTimestampedIntoMessageObj(
        [{ role: 'assistant', content: 'Hi from messageObj' }],
        [],
      ),
    ).toEqual([{ role: 'assistant', content: 'Hi from messageObj' }]);
  });

  it('keeps a repeated message when it arrives as a new send', () => {
    const merged = mergeChatTurns(
      [
        {
          role: 'user',
          content: 'ok',
          id: 'in-1',
          timestamp: '2026-10-01T10:00:00.000Z',
        },
      ],
      [
        {
          role: 'user',
          content: 'ok',
          id: 'in-2',
          timestamp: '2026-10-08T10:00:00.000Z',
        },
      ],
    );

    expect(merged.map((turn) => turn.id)).toEqual(['in-1', 'in-2']);
  });

  it('keeps an identical turn with no id when it is sent much later', () => {
    const merged = mergeChatTurns(
      [
        {
          role: 'assistant',
          content: 'Following up',
          timestamp: '2026-10-01T10:00:00.000Z',
        },
      ],
      [
        {
          role: 'assistant',
          content: 'Following up',
          timestamp: '2026-10-08T10:00:00.000Z',
        },
      ],
    );

    expect(merged).toHaveLength(2);
  });

  it('still collapses a re-delivered copy without id or timestamp', () => {
    const merged = mergeChatTurns(
      [{ role: 'user', content: 'No, thank you' }],
      [{ role: 'user', content: 'No, thank you' }],
    );

    expect(merged).toHaveLength(1);
  });

  it('absorbs each stored turn once so two real repeats both survive', () => {
    const merged = mergeChatTurns(
      [{ role: 'user', content: 'ok' }],
      [
        { role: 'user', content: 'ok' },
        { role: 'user', content: 'ok' },
      ],
    );

    expect(merged).toHaveLength(2);
  });
});
