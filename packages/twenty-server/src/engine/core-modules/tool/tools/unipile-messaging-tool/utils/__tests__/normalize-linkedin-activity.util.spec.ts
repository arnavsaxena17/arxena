import {
  normalizeLinkedinActivityPosts,
  normalizeLinkedinActivityUserComments,
  pickMostRecentLinkedinActivityPost,
} from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/normalize-linkedin-activity.util';

describe('normalizeLinkedinActivity', () => {
  it('normalizes posts and prefers most recent original', () => {
    const posts = normalizeLinkedinActivityPosts(
      {
        items: [
          {
            id: '1',
            social_id: 'urn:li:activity:old',
            text: 'Old original',
            parsed_datetime: '2025-01-01T00:00:00.000Z',
            is_repost: false,
            share_url: 'https://linkedin.com/1',
          },
          {
            id: '2',
            social_id: 'urn:li:activity:repost',
            text: 'Fresh repost',
            parsed_datetime: '2025-06-01T00:00:00.000Z',
            is_repost: true,
          },
          {
            id: '3',
            social_id: 'urn:li:activity:recent',
            text: 'Recent original',
            parsed_datetime: '2025-05-01T00:00:00.000Z',
            is_repost: false,
          },
        ],
      },
      10,
    );

    expect(posts).toHaveLength(3);
    expect(pickMostRecentLinkedinActivityPost(posts)).toEqual(
      expect.objectContaining({
        socialId: 'urn:li:activity:recent',
        text: 'Recent original',
      }),
    );
  });

  it('falls back to repost when no originals exist', () => {
    const posts = normalizeLinkedinActivityPosts(
      {
        items: [
          {
            social_id: 'urn:li:activity:r1',
            text: 'Only repost',
            parsed_datetime: '2025-02-01T00:00:00.000Z',
            is_repost: true,
          },
        ],
      },
      10,
    );

    expect(pickMostRecentLinkedinActivityPost(posts)?.socialId).toBe(
      'urn:li:activity:r1',
    );
  });

  it('normalizes user comments', () => {
    const comments = normalizeLinkedinActivityUserComments(
      {
        items: [
          {
            id: 'c1',
            post_id: 'p1',
            text: 'Nice take.',
            date: '2025-03-01',
          },
          { id: 'c2', text: '   ' },
        ],
      },
      10,
    );

    expect(comments).toEqual([
      {
        id: 'c1',
        postId: 'p1',
        text: 'Nice take.',
        date: '2025-03-01',
      },
    ]);
  });
});
