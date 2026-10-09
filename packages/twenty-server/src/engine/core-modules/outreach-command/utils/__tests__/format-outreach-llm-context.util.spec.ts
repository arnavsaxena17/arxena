import {
  buildFindRecordsLlmText,
  formatOutreachProspectEnrichmentForLlm,
  formatOutreachProspectPostsForLlm,
  formatOutreachProspectProfileForLlm,
  formatOutreachSenderForLlm,
  formatOutreachSlotsForLlm,
  formatOutreachTranscriptForLlm,
  rewriteOutreachResolvedPromptSections,
} from '../format-outreach-llm-context.util';

describe('formatOutreachTranscriptForLlm', () => {
  it('folds find-records chatMessage dumps into us/them turns', () => {
    const transcript = formatOutreachTranscriptForLlm({
      first: {
        channel: 'LINKEDIN',
        messageObj: [
          {
            role: 'user',
            content: 'Thanks, I am interested. Can we talk next week?',
          },
        ],
      },
      all: [
        {
          channel: 'LINKEDIN',
          messageObj: [
            {
              role: 'user',
              content: 'Thanks, I am interested. Can we talk next week?',
            },
          ],
        },
      ],
      totalCount: 1,
    });

    expect(transcript).toBe(
      'them: Thanks, I am interested. Can we talk next week?',
    );
  });

  it('leaves unresolved workflow templates alone', () => {
    expect(formatOutreachTranscriptForLlm('{{step.text}}')).toBe(
      '{{step.text}}',
    );
  });

  it('folds Unipile fetch-linkedin-messages envelopes into us/them turns', () => {
    expect(
      formatOutreachTranscriptForLlm({
        success: true,
        chatId: '',
        attendeeId: 'ACoAAAup_vUBg-znzOwjDf7Ro5xmidw6dCrh58I',
        total: 1,
        messages: [
          {
            id: 'mock-inbound-1',
            text: 'Thanks, I am interested. Can we talk next week?',
            timestamp: '2026-09-09T14:25:29.886Z',
            senderId: '',
            isSender: false,
          },
        ],
        error: '',
      }),
    ).toBe('them [9 Sept, 7:55 pm IST]: Thanks, I am interested. Can we talk next week?');
  });
});

describe('formatOutreachTranscriptForLlm history handling', () => {
  const turn = (index: number, role = 'user') => ({
    role,
    content: `message ${index}`,
    timestamp: new Date(Date.UTC(2026, 8, 1, 10, index)).toISOString(),
  });

  it('keeps timestamps so the model can see how old a reply is', () => {
    const text = formatOutreachTranscriptForLlm([
      {
        role: 'user',
        content: 'Not now',
        timestamp: '2026-10-08T08:31:00.000Z',
      },
    ]);

    expect(text).toBe('them [8 Oct, 2:01 pm IST]: Not now');
  });

  it('folds old turns into a facts line and keeps the recent ones verbatim', () => {
    const turns = [
      { role: 'user', content: 'mail me at abc@panda.com or +91 84119 37769' },
      ...Array.from({ length: 40 }, (_, index) => turn(index + 1)),
    ];
    const text = formatOutreachTranscriptForLlm(turns);

    expect(text.split('\n---\n')[0]).toContain('earlier messages omitted');
    expect(text.split('\n---\n')[0]).toContain('abc@panda.com');
    expect(text.split('\n---\n')[0]).toContain('+91 84119 37769');
    expect(text).toContain('message 40');
    expect(text).not.toContain('message 1:');
    expect(text.split('\n---\n')).toHaveLength(31);
  });

  it('merges several channels into one timeline and tags the channel', () => {
    const text = formatOutreachTranscriptForLlm({
      all: [
        {
          channel: 'EMAIL',
          messageObj: [
            {
              role: 'assistant',
              content: 'email out',
              timestamp: '2026-10-02T10:00:00.000Z',
            },
          ],
        },
        {
          channel: 'LINKEDIN',
          messageObj: [
            {
              role: 'user',
              content: 'linkedin one',
              timestamp: '2026-10-01T10:00:00.000Z',
            },
            {
              role: 'user',
              content: 'linkedin two',
              timestamp: '2026-10-03T10:00:00.000Z',
            },
          ],
        },
      ],
    });
    const lines = text.split('\n---\n');

    expect(lines.map((line) => line.split(': ')[1])).toEqual([
      'linkedin one',
      'email out',
      'linkedin two',
    ]);
    expect(lines[1]).toContain('EMAIL');
  });

  it('labels system notes separately from the prospect', () => {
    expect(
      formatOutreachTranscriptForLlm([
        { role: 'system', content: 'Member notified to send the deck' },
      ]),
    ).toBe('system: Member notified to send the deck');
  });
});

describe('formatOutreachSlotsForLlm', () => {
  it('renders indexed windows in human-readable IST', () => {
    expect(
      formatOutreachSlotsForLlm([
        {
          startsAt: '2024-11-10T09:00:00.000Z',
          endsAt: '2024-11-10T09:30:00.000Z',
        },
      ]),
    ).toBe('(0) Sun, Nov 10 · 2:30–3:00 PM IST');
  });

  it('re-humanizes leftover ISO indexed lines', () => {
    expect(
      formatOutreachSlotsForLlm(
        '(0) 2026-09-17T05:30:00.849Z → 2026-09-17T05:50:00.849Z',
      ),
    ).toBe('(0) Thu, Sep 17 · 11:00–11:20 AM IST');
  });
});

describe('formatOutreachSenderForLlm', () => {
  it('formats slim sender profile brief', () => {
    const formatted = formatOutreachSenderForLlm({
      targetTitles: ['CFO'],
      locations: ['India'],
      brief:
        'Sender: Naresh Lahoti · Founder · Projective Tech\nOffer: IMAGE-I realtime MIS',
    });

    expect(formatted).toContain('Sender: Naresh Lahoti');
    expect(formatted).toContain('Offer: IMAGE-I');
    expect(formatted).toContain('Target titles: CFO');
    expect(formatted).toContain('Locations: India');
    expect(formatted).not.toContain('"product_name"');
  });

  it('unwraps outreachSenderProfile off a workspace member row', () => {
    const formatted = formatOutreachSenderForLlm({
      name: { firstName: 'Arnav', lastName: 'Saxena' },
      phoneNumber: '+910000000000',
      linkedinLiAtToken: 'secret',
      outreachSenderProfile: {
        brief: 'Naresh Lahoti\nFounder',
        locations: ['India'],
        targetTitles: ['CFO'],
        collateralFiles: [],
      },
    });

    expect(formatted).toContain('Naresh Lahoti');
    expect(formatted).toContain('Target titles: CFO');
    expect(formatted).toContain('Locations: India');
    expect(formatted).not.toContain('linkedinLiAtToken');
    expect(formatted).not.toContain('+910000000000');
  });

  it('unwraps a find-records envelope to the first sender profile', () => {
    const formatted = formatOutreachSenderForLlm({
      first: {
        linkedinUnipileAccountId: 'secret-account',
        outreachSenderProfile: {
          brief: 'Sender brief',
          targetTitles: ['CFO'],
          locations: ['India'],
        },
      },
      all: [],
      totalCount: 1,
    });

    expect(formatted).toContain('Sender brief');
    expect(formatted).toContain('Target titles: CFO');
    expect(formatted).not.toContain('secret-account');
    expect(formatted).not.toContain('totalCount');
  });
});

describe('formatOutreachProspectEnrichmentForLlm', () => {
  it('formats enrichment hooks as a readable list', () => {
    const formatted = formatOutreachProspectEnrichmentForLlm({
      go: true,
      score: 4,
      segment: 'cfo',
      reason: 'ICP match',
      first_name: 'Arvind',
      honorific: null,
      company_short: 'Dangote',
      industry_phrase: 'cement',
      hooks: [{ text: 'Multi-plant finance', source: 'crm' }],
      likely_systems: 'ERP',
      matching_problem_statement: 'Late MIS',
      referral_source: null,
    });

    expect(formatted).toContain('Prospect: Arvind · Dangote');
    expect(formatted).toContain('- (0) Multi-plant finance [crm]');
    expect(formatted).not.toContain('"hooks"');
  });
});

describe('buildFindRecordsLlmText', () => {
  it('uses a plain transcript for chatMessage rows', () => {
    expect(
      buildFindRecordsLlmText([
        {
          channel: 'LINKEDIN',
          messageObj: [{ role: 'assistant', content: 'Hi there' }],
        },
      ]),
    ).toBe('us: Hi there');
  });

  it('formats workspace member rows from outreachSenderProfile', () => {
    const text = buildFindRecordsLlmText([
      {
        id: 'member-1',
        phoneNumber: '+910000000000',
        outreachSenderProfile: {
          brief: 'Naresh Lahoti',
          targetTitles: ['CFO'],
          locations: ['India'],
        },
      },
    ]);

    expect(text).toContain('Naresh Lahoti');
    expect(text).toContain('Target titles: CFO');
    expect(text).toContain('Locations: India');
    expect(text).not.toContain('phoneNumber');
    expect(text).not.toContain('"first"');
  });
});

describe('rewriteOutreachResolvedPromptSections', () => {
  it('rewrites SENDER_JSON blobs after resolveInput', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      [
        'SENDER_JSON: {"targetTitles":["CFO"],"locations":["India"],"brief":"Sender: Naresh\\nOffer: IMAGE-I"}',
        'Available slots (only source of times): [{"startsAt":"2024-11-10T09:00:00.000Z","endsAt":"2024-11-10T09:30:00.000Z"}]',
      ].join('\n'),
    );

    expect(rewritten).toContain('Sender: Naresh');
    expect(rewritten).toContain('(0) Sun, Nov 10 · 2:30–3:00 PM IST');
    expect(rewritten).not.toContain('"targetTitles"');
  });

  it('rewrites a SENDER_JSON find-records dump with no space after the colon', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      'SENDER_JSON:{"first":{"outreachSenderProfile":{"brief":"Naresh","targetTitles":["CFO"],"locations":["India"]},"linkedinLiAtToken":"secret"},"all":[],"totalCount":1}',
    );

    expect(rewritten).toContain('Naresh');
    expect(rewritten).toContain('Target titles: CFO');
    expect(rewritten).toContain('Locations: India');
    expect(rewritten).not.toContain('linkedinLiAtToken');
    expect(rewritten).not.toContain('"first"');
  });

  it('rewrites a Prospect enrichment object', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      [
        'Prospect: {"hooks":[{"text":"Director Of Operations - Saudi Paper Group","source":"profile"}],"first_name":"Mohammad","company_short":"Saudi Paper Group"}',
        'Prospect Profile: Mohammad Abdelghaffar',
      ].join('\n'),
    );

    expect(rewritten).toContain('Prospect: Mohammad · Saudi Paper Group');
    expect(rewritten).toContain(
      '- (0) Director Of Operations - Saudi Paper Group [profile]',
    );
    expect(rewritten).toContain('Prospect Profile: Mohammad Abdelghaffar');
    expect(rewritten).not.toContain('"hooks"');
    expect(rewritten).not.toContain('Prospect: Prospect:');
  });

  it('rewrites chat_history Unipile dumps into us/them turns', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      [
        'chat_history: {"success":true,"messages":[{"text":"Thanks, I am interested. Can we talk next week?","isSender":false}]}',
        'calendar: [{"startsAt":"2026-09-15T05:30:00.412Z","endsAt":"2026-09-15T05:50:00.412Z"}]',
      ].join('\n'),
    );

    expect(rewritten).toContain(
      'chat_history: them: Thanks, I am interested. Can we talk next week?',
    );
    expect(rewritten).toContain(
      'calendar: (0) Tue, Sep 15 · 11:00–11:20 AM IST',
    );
    expect(rewritten).not.toContain('"isSender"');
  });

  it('keeps empty prospect_posts as (none) without swallowing chat_history', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      [
        'prospect_posts: ',
        'chat_history: us: Thanks for connecting',
        'calendar (ignore — do not use): [{"startsAt":"2026-09-25T08:30:00.000Z","endsAt":"2026-09-25T08:50:00.000Z"}]',
      ].join('\n'),
    );

    expect(rewritten).toContain('prospect_posts: (none)');
    expect(rewritten).toContain('chat_history: us: Thanks for connecting');
    expect(rewritten).toContain(
      'calendar (ignore — do not use): (0) Fri, Sep 25 · 2:00–2:20 PM IST',
    );
    expect(rewritten).not.toContain('prospect_posts: chat_history:');
    expect(rewritten).not.toContain('"startsAt"');
  });

  it('rewrites prospect_profile JSON into readable prose', () => {
    const rewritten = rewriteOutreachResolvedPromptSections(
      'prospect_profile: {"success":true,"firstName":"Mohammad","lastName":"Abdelghaffar","headline":"Director Of Operations","about":"27 years in tissue"}',
    );

    expect(rewritten).toContain('prospect_profile: Mohammad Abdelghaffar');
    expect(rewritten).toContain('Director Of Operations');
    expect(rewritten).not.toContain('"success"');
  });
});

describe('formatOutreachProspectProfileForLlm', () => {
  it('formats profile fields without raw snapshot JSON', () => {
    const formatted = formatOutreachProspectProfileForLlm({
      firstName: 'Mohammad',
      lastName: 'Abdelghaffar',
      headline: 'Director Of Operations - Saudi Paper Group',
      about: '27 years experience',
      location: 'Eastern, Saudi Arabia',
      experience: [
        {
          position: 'Director Of Operations',
          company: 'Saudi Paper Group',
          start: '10/1/2019',
          end: '',
        },
      ],
      skills: ['Engineering'],
      snapshot: '{"huge":true}',
    });

    expect(formatted).toContain('Mohammad Abdelghaffar');
    expect(formatted).toContain(
      '- Director Of Operations @ Saudi Paper Group (10/1/2019 – Present)',
    );
    expect(formatted).not.toContain('snapshot');
    expect(formatted).not.toContain('"huge"');
  });
});

describe('formatOutreachProspectPostsForLlm', () => {
  it('renders indexed post texts with optional timestamps', () => {
    expect(
      formatOutreachProspectPostsForLlm([
        {
          text: 'We closed books in 3 days.',
          parsedDatetime: '2026-09-01T10:00:00.000Z',
        },
        { text: 'Hiring a FP&A lead.' },
      ]),
    ).toBe(
      [
        '- (0) (2026-09-01T10:00:00.000Z) We closed books in 3 days.',
        '- (1) Hiring a FP&A lead.',
      ].join('\n'),
    );
  });

  it('prefers result.text when present', () => {
    expect(
      formatOutreachProspectPostsForLlm({
        text: '- (0) Already formatted',
        posts: [{ text: 'ignored' }],
      }),
    ).toBe('- (0) Already formatted');
  });
});
