import { mergePersonLinkedinPostsField } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/merge-person-linkedin-posts.util';

describe('mergePersonLinkedinPostsField', () => {
  it('unions by socialId and keeps newer incoming on collision', () => {
    const merged = mergePersonLinkedinPostsField({
      existing: {
        fetchedAt: '2026-01-01T00:00:00.000Z',
        posts: [
          {
            socialId: 'urn:li:activity:1',
            text: 'old',
            parsedDatetime: '2026-01-01T00:00:00.000Z',
            isRepost: false,
          },
          {
            socialId: 'urn:li:activity:2',
            text: 'keep',
            parsedDatetime: '2026-01-02T00:00:00.000Z',
            isRepost: false,
          },
        ],
        mostRecentPost: null,
      },
      incomingPosts: [
        {
          socialId: 'urn:li:activity:1',
          text: 'updated',
          parsedDatetime: '2026-01-01T00:00:00.000Z',
          isRepost: false,
        },
        {
          socialId: 'urn:li:activity:3',
          text: 'new',
          parsedDatetime: '2026-01-03T00:00:00.000Z',
          isRepost: false,
        },
      ],
      incomingMostRecentPost: {
        socialId: 'urn:li:activity:3',
        text: 'new',
      },
    });

    expect(merged.posts).toHaveLength(3);
    expect(
      merged.posts.map(
        (post) => (post as { socialId: string; text: string }).text,
      ),
    ).toEqual(['new', 'keep', 'updated']);
    expect(merged.mostRecentPost).toEqual({
      socialId: 'urn:li:activity:3',
      text: 'new',
    });
    expect(merged.fetchedAt).toBeTruthy();
  });
});
