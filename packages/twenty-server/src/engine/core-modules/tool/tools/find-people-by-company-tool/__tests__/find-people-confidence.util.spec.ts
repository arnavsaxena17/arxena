import {
  confidenceOf,
  freshnessOf,
  meetsConfidence,
  rungOf,
  terminalStateOf,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-confidence.util';

const NOW = Date.parse('2026-10-29T00:00:00.000Z');

describe('freshnessOf', () => {
  it('should be unknown when the record carries no date', () => {
    expect(freshnessOf({ name: 'x' }, 365, NOW)).toBe('unknown');
  });

  it('should be current inside the window and unverified past it', () => {
    expect(freshnessOf({ timestamp: '2026-06-01' }, 365, NOW)).toBe('current');
    expect(freshnessOf({ updated_at: '2024-01-01' }, 365, NOW)).toBe(
      'unverified',
    );
  });
});

describe('confidenceOf', () => {
  const base = {
    sources: ['bright_data'],
    judged: true,
    exactRole: true,
    relatedCompany: false,
    freshness: 'unknown' as const,
    hasLinkedinUrl: true,
  };

  it('should be high when two independent sources agree', () => {
    expect(confidenceOf({ ...base, sources: ['bright_data', 'google'] })).toBe(
      'high',
    );
  });

  it('should not count Google and the pages it returned as two sources', () => {
    expect(
      confidenceOf({ ...base, sources: ['google', 'web'], judged: false }),
    ).toBe('low');
  });

  it('should be high for one fresh Bright Data profile the judge read', () => {
    expect(confidenceOf({ ...base, freshness: 'current' })).toBe('high');
  });

  it('should be medium for one judged source of unknown age', () => {
    expect(confidenceOf(base)).toBe('medium');
  });

  it('should be low for a stale record, whatever else agrees', () => {
    expect(
      confidenceOf({
        ...base,
        sources: ['bright_data', 'google'],
        freshness: 'unverified',
      }),
    ).toBe('low');
  });

  it('should keep a related role from being high', () => {
    expect(
      confidenceOf({
        ...base,
        exactRole: false,
        sources: ['bright_data', 'google'],
      }),
    ).toBe('medium');
  });
});

describe('meetsConfidence', () => {
  it('should order low < medium < high', () => {
    expect(meetsConfidence('high', 'medium')).toBe(true);
    expect(meetsConfidence('medium', 'medium')).toBe(true);
    expect(meetsConfidence('low', 'medium')).toBe(false);
  });
});

describe('rungOf', () => {
  it('should be 1 for the title as typed and 2 for an equivalent', () => {
    expect(
      rungOf({ roleScore: 2, title: 'CEO', roles: ['CEO'], ownerPass: false }),
    ).toBe(1);
    expect(
      rungOf({
        roleScore: 2,
        title: 'Managing Director',
        roles: ['CEO'],
        ownerPass: false,
      }),
    ).toBe(2);
  });

  it('should be 3 for a related role and 4 for the owner pass', () => {
    expect(
      rungOf({
        roleScore: 1,
        title: 'Deputy CEO',
        roles: ['CEO'],
        ownerPass: false,
      }),
    ).toBe(3);
    expect(
      rungOf({
        roleScore: 2,
        title: 'Founder',
        roles: ['Founder'],
        ownerPass: true,
      }),
    ).toBe(4);
  });
});

describe('terminalStateOf', () => {
  const run = (overrides: Partial<Parameters<typeof terminalStateOf>[0]>) =>
    terminalStateOf({
      people: [],
      maxRung: 3,
      minConfidence: 'medium',
      sourceFailed: false,
      budgetExhausted: false,
      rejectedCount: 0,
      ...overrides,
    });

  it('should be found when someone eligible meets the confidence', () => {
    expect(
      run({
        people: [{ rungUsed: 2, confidence: 'medium', relatedCompany: false }],
      }),
    ).toEqual({ terminalState: 'found' });
  });

  it('should be ambiguous when the only people are low confidence', () => {
    expect(
      run({
        people: [{ rungUsed: 1, confidence: 'low', relatedCompany: false }],
      }),
    ).toEqual({ terminalState: 'ambiguous', reason: 'low_confidence' });
  });

  it('should be ambiguous on a questionable company match', () => {
    expect(
      run({
        people: [{ rungUsed: 1, confidence: 'high', relatedCompany: true }],
      }),
    ).toEqual({ terminalState: 'ambiguous', reason: 'company_match' });
  });

  it('should not count people above the plan rung', () => {
    expect(
      run({
        maxRung: 2,
        people: [{ rungUsed: 3, confidence: 'high', relatedCompany: false }],
      }),
    ).toEqual({ terminalState: 'none_found', reason: 'no_such_role' });
  });

  it('should give the reason when nobody was found', () => {
    expect(run({ sourceFailed: true }).reason).toBe('source_error');
    expect(run({ budgetExhausted: true }).reason).toBe('budget');
    expect(run({ rejectedCount: 2 }).reason).toBe('profile_gaps');
  });
});
