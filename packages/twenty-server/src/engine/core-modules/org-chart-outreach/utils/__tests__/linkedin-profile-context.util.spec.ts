import {
    buildOutreachProfileContext,
    summarizeLinkedinComments,
    summarizeLinkedinPosts,
    summarizeLinkedinProfile,
} from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';

describe('linkedin-profile-context.util', () => {
  const targetProfileFixture = {
    public_identifier: 'prenisha-harry-075760b',
    first_name: 'Prenisha',
    last_name: 'Harry',
    headline: 'Senior People Director, International - e.l.f Beauty',
    location: 'London, England, United Kingdom',
    work_experience: [
      {
        company: 'E.L.F. BEAUTY',
        position: 'Senior People Director, International',
        start: '1/1/2025',
        end: null,
      },
      {
        company: 'Pandora',
        position: 'HR Director',
        start: '4/1/2018',
        end: '5/1/2022',
      },
    ],
    skills: [{ name: 'Human Resources' }, { name: 'Talent Management' }],
  };

  it('summarizeLinkedinProfile extracts key fields', () => {
    console.log('summarizeLinkedinProfile: start');
    const summary = summarizeLinkedinProfile(targetProfileFixture);

    expect(summary.publicIdentifier).toBe('prenisha-harry-075760b');
    expect(summary.firstName).toBe('Prenisha');
    expect(summary.headline).toContain('e.l.f Beauty');
    expect(summary.currentRole?.company).toBe('E.L.F. BEAUTY');
    expect(summary.recentExperience).toHaveLength(2);
    expect(summary.skills).toEqual(['Human Resources', 'Talent Management']);
    console.log('summarizeLinkedinProfile: success', summary);
  });

  it('summarizeLinkedinPosts prefers original posts over reposts', () => {
    console.log('summarizeLinkedinPosts: start');
    const posts = summarizeLinkedinPosts(
      {
        items: [
          {
            text: 'Reposted content',
            is_repost: true,
            parsed_datetime: '2025-09-04T10:54:09.733Z',
          },
          {
            text: 'Original announcement',
            is_repost: false,
            parsed_datetime: '2025-01-08T09:28:34.694Z',
          },
        ],
      },
      10,
    );

    expect(posts).toHaveLength(2);
    expect(posts[0]?.text).toBe('Original announcement');
    expect(posts[0]?.isRepost).toBe(false);
    console.log('summarizeLinkedinPosts: success', posts);
  });

  it('summarizeLinkedinComments maps comment text', () => {
    console.log('summarizeLinkedinComments: start');
    const comments = summarizeLinkedinComments(
      {
        items: [
          {
            text: 'Congratulations!!!',
            date: '2026-05-12T11:48:26.686Z',
          },
        ],
      },
      10,
    );

    expect(comments).toHaveLength(1);
    expect(comments[0]?.text).toBe('Congratulations!!!');
    console.log('summarizeLinkedinComments: success', comments);
  });

  it('buildOutreachProfileContext combines sender and target summaries', () => {
    console.log('buildOutreachProfileContext: start');
    const context = buildOutreachProfileContext({
      senderProfile: {
        public_identifier: 'saikrshna',
        first_name: 'Sai krishna',
        last_name: 'Varma',
        headline: 'CHRO @ RYT Advisory',
        work_experience: [],
        skills: [],
      },
      targetProfile: targetProfileFixture,
      postsPayload: {
        items: [{ text: 'Excited for e.l.f.', is_repost: false }],
      },
      commentsPayload: { items: [] },
    });

    expect(context.sender.publicIdentifier).toBe('saikrshna');
    expect(context.target.publicIdentifier).toBe('prenisha-harry-075760b');
    expect(context.posts).toHaveLength(1);
    expect(context.comments).toHaveLength(0);
    console.log('buildOutreachProfileContext: success', context);
  });
});
