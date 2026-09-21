import {
  buildFindRecordsLlmText,
  formatOutreachProspectEnrichmentForLlm,
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
    ).toBe('them: Thanks, I am interested. Can we talk next week?');
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
});
