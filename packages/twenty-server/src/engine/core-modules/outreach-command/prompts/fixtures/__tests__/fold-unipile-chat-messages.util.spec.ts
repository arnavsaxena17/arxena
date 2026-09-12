import {
  foldUnipileChatMessagesToTranscript,
  truncateTranscriptAfterLastInbound,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/fold-unipile-chat-messages.util';

describe('foldUnipileChatMessagesToTranscript', () => {
  it('sorts oldest to newest and labels us/them', () => {
    const transcript = foldUnipileChatMessagesToTranscript([
      {
        is_sender: 0,
        timestamp: '2024-11-02T00:00:00.000Z',
        text: 'second inbound',
      },
      {
        is_sender: 1,
        timestamp: '2024-11-01T00:00:00.000Z',
        text: 'first outbound',
      },
    ]);

    expect(transcript).toBe(
      ['us: first outbound', 'them: second inbound'].join('\n---\n'),
    );
  });

  it('truncates after the last inbound turn', () => {
    const transcript = truncateTranscriptAfterLastInbound(
      [
        'us: opener',
        'them: interested',
        'us: follow up',
      ].join('\n---\n'),
    );

    expect(transcript).toBe(['us: opener', 'them: interested'].join('\n---\n'));
  });
});
