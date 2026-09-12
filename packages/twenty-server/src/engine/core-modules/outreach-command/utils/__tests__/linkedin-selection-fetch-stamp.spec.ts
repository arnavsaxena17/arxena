import { pickMostRecentLinkedinActivityPost } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/normalize-linkedin-activity.util';

describe('linkedin selection fetch stamp shape', () => {
  it('picks the newest original post for mostRecentPost', () => {
    expect(
      pickMostRecentLinkedinActivityPost([
        {
          id: '1',
          text: 'older',
          parsedDatetime: '2024-01-01T00:00:00.000Z',
          isRepost: false,
        },
        {
          id: '2',
          text: 'newer',
          parsedDatetime: '2025-01-01T00:00:00.000Z',
          isRepost: false,
        },
        {
          id: '3',
          text: 'repost',
          parsedDatetime: '2026-01-01T00:00:00.000Z',
          isRepost: true,
        },
      ])?.id,
    ).toBe('2');
  });
});
