import { OUTREACH_SEQUENCE_STAGE_OPTIONS } from 'src/engine/workspace-manager/arxena-standard-metadata/data/outreach-command-fields.data';

import {
  decideCompanyDedupe,
  normalizeCompanyKey,
  OUTREACH_CONTACTED_COMPANY_STAGES,
  type CompanyDedupeSibling,
} from 'src/engine/core-modules/outreach-command/utils/company-dedupe-decision.util';

const SELF_ID = 'candidate-self';
const SELF_CREATED_AT = '2026-11-01T10:00:00.000Z';

const sibling = (
  overrides: Partial<CompanyDedupeSibling> & { candidateId: string },
): CompanyDedupeSibling => ({
  companyName: 'Acme',
  stage: 'QUEUED',
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const decide = ({
  companyName = 'Acme',
  siblings = [] as CompanyDedupeSibling[],
}: {
  companyName?: string | null;
  siblings?: CompanyDedupeSibling[];
}) =>
  decideCompanyDedupe({
    selfCandidateId: SELF_ID,
    companyName,
    selfCreatedAt: SELF_CREATED_AT,
    siblings,
  });

describe('normalizeCompanyKey', () => {
  it('should strip legal suffixes and punctuation', () => {
    expect(normalizeCompanyKey('Acme Corp.')).toBe('acme');
    expect(normalizeCompanyKey('ACME PRIVATE LIMITED')).toBe('acme');
    expect(normalizeCompanyKey('Acme Technologies Pvt. Ltd.')).toBe(
      'acme technologies',
    );
  });

  it('should keep the same key across spellings of one employer', () => {
    const keys = [
      'Acme Inc',
      'acme',
      ' ACME, LLC ',
      'Acme Ltd.',
      'Acme GmbH',
      'ACME PVT LTD',
    ].map(normalizeCompanyKey);

    expect(keys).toEqual(new Array(keys.length).fill('acme'));
  });

  it('should not drop a legal token that is not trailing', () => {
    expect(normalizeCompanyKey('Corporate Broking Ltd')).toBe(
      'corporate broking',
    );
  });

  it('should return an empty key for blank input', () => {
    expect(normalizeCompanyKey()).toBe('');
    expect(normalizeCompanyKey(null)).toBe('');
    expect(normalizeCompanyKey('   ')).toBe('');
    expect(normalizeCompanyKey('Ltd')).toBe('');
  });
});

describe('decideCompanyDedupe', () => {
  it('should not defer when the prospect has no company', () => {
    expect(decide({ companyName: '', siblings: [] }).reason).toBe('no-company');

    // A sibling exists but cannot be compared without a company name.
    const decision = decide({
      companyName: '   ',
      siblings: [sibling({ candidateId: 'other', stage: 'REPLIED' })],
    });

    expect(decision.deferred).toBe(false);
    expect(decision.reason).toBe('no-company');
  });

  it('should defer when a same-company sibling is already contacted', () => {
    const decision = decide({
      siblings: [
        sibling({ candidateId: 'contacted', stage: 'CONNECTION_SENT' }),
      ],
    });

    expect(decision).toEqual({
      deferred: true,
      reason: 'company-contacted',
      matchedCandidateId: 'contacted',
      companyKey: 'acme',
      consideredSiblings: 1,
    });
  });

  it('should match the company through spelling variants', () => {
    const decision = decide({
      companyName: 'Acme Technologies Pvt. Ltd.',
      siblings: [
        sibling({
          candidateId: 'contacted',
          companyName: 'ACME TECHNOLOGIES, INC.',
          stage: 'EMAIL_SENT',
        }),
      ],
    });

    expect(decision.reason).toBe('company-contacted');
    expect(decision.matchedCandidateId).toBe('contacted');
  });

  it('should not defer for a different company in the same project', () => {
    // The pre-fix graph dropped the company clause, so this case deferred.
    const decision = decide({
      siblings: [
        sibling({ candidateId: 'other', companyName: 'Globex', stage: 'REPLIED' }),
      ],
    });

    expect(decision.deferred).toBe(false);
    expect(decision.reason).toBe('clear');
  });

  it('should not defer on a mere substring match', () => {
    const decision = decide({
      companyName: 'Apple',
      siblings: [
        sibling({
          candidateId: 'other',
          companyName: 'Pineapple Studios',
          stage: 'REPLIED',
        }),
      ],
    });

    expect(decision.deferred).toBe(false);
  });

  it('should not treat DEFERRED, STOPPED or QUEUED as contacted', () => {
    for (const stage of ['DEFERRED', 'STOPPED', 'QUEUED', 'NEEDS_CONNECTION']) {
      // Created after the self record, so the earlier-queued rule cannot fire:
      // only the contacted-stage rule is under test here.
      expect(
        decide({
          siblings: [
            sibling({
              candidateId: 'other',
              stage,
              createdAt: '2026-11-05T10:00:00.000Z',
            }),
          ],
        }).deferred,
      ).toBe(false);
    }
  });

  it('should defer when an earlier QUEUED sibling holds the same company', () => {
    const decision = decide({
      siblings: [
        sibling({
          candidateId: 'earlier',
          stage: 'QUEUED',
          createdAt: '2026-10-31T09:00:00.000Z',
        }),
      ],
    });

    expect(decision.reason).toBe('earlier-queued-sibling');
    expect(decision.matchedCandidateId).toBe('earlier');
  });

  it('should not defer to a later QUEUED sibling', () => {
    const decision = decide({
      siblings: [
        sibling({
          candidateId: 'later',
          stage: 'QUEUED',
          createdAt: '2026-11-02T09:00:00.000Z',
        }),
      ],
    });

    expect(decision.deferred).toBe(false);
  });

  it('should prefer company-contacted over earlier-queued', () => {
    const decision = decide({
      siblings: [
        sibling({
          candidateId: 'earlier',
          stage: 'QUEUED',
          createdAt: '2026-10-31T09:00:00.000Z',
        }),
        sibling({ candidateId: 'contacted', stage: 'REPLIED' }),
      ],
    });

    expect(decision.reason).toBe('company-contacted');
    expect(decision.matchedCandidateId).toBe('contacted');
  });

  it('should ignore the candidate itself', () => {
    const decision = decide({
      siblings: [
        sibling({
          candidateId: SELF_ID,
          stage: 'CONNECTION_SENT',
          createdAt: SELF_CREATED_AT,
        }),
      ],
    });

    expect(decision.deferred).toBe(false);
  });

  it('should not throw on unparsable created dates', () => {
    const decision = decide({
      siblings: [
        sibling({ candidateId: 'earlier', stage: 'QUEUED', createdAt: 'garbage' }),
      ],
    });

    expect(decision.deferred).toBe(false);
  });
});

describe('OUTREACH_CONTACTED_COMPANY_STAGES', () => {
  it('should cover every outreach stage except the untouched ones', () => {
    const untouched = new Set([
      'QUEUED',
      'NEEDS_CONNECTION',
      'DEFERRED',
      'STOPPED',
    ]);
    const expected = OUTREACH_SEQUENCE_STAGE_OPTIONS.map(
      (option) => option.value,
    )
      .filter((value) => !untouched.has(value))
      .sort();

    // Guards against a new stage landing in metadata without a decision here:
    // a silently untreated stage would make the gate defer too little.
    expect([...OUTREACH_CONTACTED_COMPANY_STAGES].sort()).toEqual(expected);
  });
});
