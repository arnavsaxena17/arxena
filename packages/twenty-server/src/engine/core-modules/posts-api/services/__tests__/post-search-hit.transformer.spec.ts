import { PostSearchHitTransformer } from '../post-search-hit.transformer';

describe('PostSearchHitTransformer', () => {
  const transformer = new PostSearchHitTransformer();

  it('maps Unipile post items to the standard hit shape', () => {
    expect(
      transformer.fromUnipileItems([
        {
          type: 'POST',
          id: 'post-1',
          social_id: 'urn:li:activity:1',
          share_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
          title: 'Hiring',
          text: 'We are hiring AEs',
          date: '2026-08-01',
          parsed_datetime: '2026-08-01T12:00:00.000Z',
          reaction_counter: 12,
          comment_counter: 3,
          is_repost: false,
          author: {
            public_identifier: 'jane-doe',
            name: 'Jane Doe',
            is_company: false,
          },
        },
        { type: 'PEOPLE', id: 'person-1' },
      ]),
    ).toEqual([
      {
        id: 'post-1',
        socialId: 'urn:li:activity:1',
        shareUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
        title: 'Hiring',
        text: 'We are hiring AEs',
        postedAt: '2026-08-01T12:00:00.000Z',
        authorName: 'Jane Doe',
        authorUrl: 'https://www.linkedin.com/in/jane-doe',
        reactionCount: 12,
        commentCount: 3,
        isRepost: false,
      },
    ]);
  });

  it('maps Harvest post items to the standard hit shape', () => {
    expect(
      transformer.fromHarvestItem({
        id: 'harvest-post-1',
        content: 'We are hiring AEs',
        linkedinUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
        article: { title: 'Hiring' },
        postedAt: { date: '2026-08-01T12:00:00.000Z' },
        author: {
          name: 'Jane Doe',
          publicIdentifier: 'jane-doe',
          linkedinUrl: 'https://www.linkedin.com/in/jane-doe',
        },
        engagement: { likes: 12, comments: 3 },
        repostId: '',
      }),
    ).toEqual({
      id: 'harvest-post-1',
      socialId: 'harvest-post-1',
      shareUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      title: 'Hiring',
      text: 'We are hiring AEs',
      postedAt: '2026-08-01T12:00:00.000Z',
      authorName: 'Jane Doe',
      authorUrl: 'https://www.linkedin.com/in/jane-doe',
      reactionCount: 12,
      commentCount: 3,
      isRepost: false,
    });
  });
});
