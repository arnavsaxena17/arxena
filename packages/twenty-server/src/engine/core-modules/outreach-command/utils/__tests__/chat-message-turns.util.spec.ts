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
});
