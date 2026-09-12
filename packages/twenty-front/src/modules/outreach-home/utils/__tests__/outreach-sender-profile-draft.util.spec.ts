import {
  parseSenderProfileDraft,
  readSenderDraftFaq,
  readSenderDraftObjections,
  readSenderDraftString,
  readSenderDraftStringList,
  writeSenderDraftFaq,
  writeSenderDraftObjections,
  writeSenderDraftString,
  writeSenderDraftStringList,
} from '@/outreach-home/utils/outreach-sender-profile-draft.util';

const SAMPLE = JSON.stringify(
  {
    id: 'test-001',
    identity: { full_name: 'Ada Lovelace', title: 'Director' },
    offer: {
      faq: [{ q: 'What?', a: 'This.' }],
      problem_statements: ['Hard to map orgs'],
    },
    icp: {
      target_roles: ['Head of TA'],
      known_objections: [
        { objection: 'Too expensive', response: 'Try a pilot' },
      ],
    },
  },
  null,
  2,
);

describe('outreach-sender-profile-draft.util', () => {
  it('reads nested strings and lists', () => {
    expect(readSenderDraftString(SAMPLE, 'identity', 'full_name')).toBe(
      'Ada Lovelace',
    );
    expect(readSenderDraftStringList(SAMPLE, 'icp', 'target_roles')).toEqual([
      'Head of TA',
    ]);
    expect(parseSenderProfileDraft('[]')).toBeNull();
  });

  it('writes nested fields without dropping siblings', () => {
    const next = writeSenderDraftString(
      SAMPLE,
      'identity',
      'how_they_sign',
      'Ada',
    );
    const parsed = parseSenderProfileDraft(next);

    expect(parsed?.identity).toEqual({
      full_name: 'Ada Lovelace',
      title: 'Director',
      how_they_sign: 'Ada',
    });
  });

  it('reads and writes faq and objections', () => {
    expect(readSenderDraftFaq(SAMPLE)).toEqual([{ q: 'What?', a: 'This.' }]);
    expect(readSenderDraftObjections(SAMPLE)).toEqual([
      { objection: 'Too expensive', response: 'Try a pilot' },
    ]);

    const withFaq = writeSenderDraftFaq(SAMPLE, [
      { q: 'Pricing?', a: 'Ask sender' },
    ]);
    expect(readSenderDraftFaq(withFaq)).toEqual([
      { q: 'Pricing?', a: 'Ask sender' },
    ]);

    const withRoles = writeSenderDraftStringList(
      SAMPLE,
      'icp',
      'target_roles',
      ['CRO'],
    );
    expect(readSenderDraftStringList(withRoles, 'icp', 'target_roles')).toEqual(
      ['CRO'],
    );

    const withObjections = writeSenderDraftObjections(SAMPLE, []);
    expect(readSenderDraftObjections(withObjections)).toEqual([]);
  });
});
