import {
  judgeRow,
  tallyJudgeOutcomes,
  type JudgeFlag,
} from 'src/domains/ingestion/candidate-sourcing/run/judge.util';

const FLAGS: JudgeFlag[] = [
  { key: 'title', description: 'VP Sales or above', kind: 'must_have' },
  { key: 'saas', description: 'SaaS employer', kind: 'must_have' },
  { key: 'banks', description: 'Sold to banks', kind: 'nice_to_have' },
  { key: 'hopping', description: 'Short stints', kind: 'red' },
  { key: 'notice', description: 'Notice under 60 days', kind: 'red' },
];

const ALL_PASS = {
  title: 'pass',
  saas: 'pass',
  banks: 'pass',
  hopping: 'pass',
  notice: 'pass',
};

const judge = (
  verdicts: Record<string, unknown>,
  evidence = { hasProfile: false, hasCompanyWeb: false },
) => judgeRow({ flags: FLAGS, verdicts, threshold: 0.6, evidence });

describe('judgeRow', () => {
  it('should qualify when every must-have passes and every red flag is cleared', () => {
    expect(judge(ALL_PASS)).toMatchObject({ outcome: 'qualified', score: 1 });
  });

  it('should fail when a red flag is confirmed, however strong the rest is', () => {
    expect(judge({ ...ALL_PASS, hopping: 'fail' })).toMatchObject({
      outcome: 'fail',
      failedKeys: ['hopping'],
    });
  });

  it('should fail when a must-have fails', () => {
    expect(judge({ ...ALL_PASS, saas: 'fail' }).outcome).toBe('fail');
  });

  it('should stay unknown when a red flag needs the profile', () => {
    expect(
      judge({
        ...ALL_PASS,
        hopping: { verdict: 'unknown', settledBy: 'profile' },
      }),
    ).toMatchObject({ outcome: 'unknown', enrich: ['profile'] });
  });

  it('should treat a missing verdict as unknown, to be settled by the profile', () => {
    const { hopping: _hopping, ...rest } = ALL_PASS;

    expect(judge(rest)).toMatchObject({
      outcome: 'unknown',
      unknownKeys: ['hopping'],
      enrich: ['profile'],
    });
  });

  it('should order enrichment cheapest first', () => {
    expect(
      judge({
        ...ALL_PASS,
        saas: { verdict: 'unknown', settledBy: 'company_web' },
        hopping: { verdict: 'unknown', settledBy: 'profile' },
      }).enrich,
    ).toEqual(['profile', 'company_web']);
  });

  it('should leave with a question when only the candidate can settle it', () => {
    expect(
      judge({
        ...ALL_PASS,
        notice: {
          verdict: 'unknown',
          settledBy: 'candidate',
          question: 'What is your notice period?',
        },
      }),
    ).toMatchObject({
      outcome: 'to_confirm',
      enrich: [],
      questions: [{ key: 'notice', question: 'What is your notice period?' }],
    });
  });

  it('should enrich before asking when both are open', () => {
    expect(
      judge({
        ...ALL_PASS,
        hopping: { verdict: 'unknown', settledBy: 'profile' },
        notice: { verdict: 'unknown', settledBy: 'candidate' },
      }),
    ).toMatchObject({ outcome: 'unknown', questions: [] });
  });

  it('should fail a must-have the profile could have shown and did not', () => {
    expect(
      judge(
        { ...ALL_PASS, saas: { verdict: 'unknown', settledBy: 'profile' } },
        { hasProfile: true, hasCompanyWeb: false },
      ),
    ).toMatchObject({ outcome: 'fail', failedKeys: ['saas'] });
  });

  it('should ask the candidate about a red flag the profile could not clear', () => {
    expect(
      judge(
        { ...ALL_PASS, hopping: { verdict: 'unknown', settledBy: 'profile' } },
        { hasProfile: true, hasCompanyWeb: false },
      ),
    ).toMatchObject({
      outcome: 'to_confirm',
      questions: [{ key: 'hopping', question: 'Please confirm: Short stints' }],
    });
  });

  it('should not block or enrich on an unknown nice-to-have', () => {
    expect(
      judge({
        ...ALL_PASS,
        banks: { verdict: 'unknown', settledBy: 'profile' },
      }),
    ).toMatchObject({ outcome: 'qualified', enrich: [] });
  });

  it('should fail a settled row below the threshold', () => {
    const result = judgeRow({
      flags: [
        { key: 'title', description: 'VP Sales', kind: 'must_have' },
        { key: 'a', description: 'A', kind: 'nice_to_have', weight: 4 },
      ],
      verdicts: { title: 'pass', a: 'fail' },
      threshold: 0.6,
    });

    expect(result).toMatchObject({ outcome: 'fail', score: 0.2 });
  });

  it('should fail without enriching when the threshold is out of reach', () => {
    const result = judgeRow({
      flags: [
        { key: 'title', description: 'VP Sales', kind: 'must_have' },
        { key: 'a', description: 'A', kind: 'nice_to_have', weight: 4 },
      ],
      verdicts: {
        title: { verdict: 'unknown', settledBy: 'profile' },
        a: 'fail',
      },
      threshold: 0.6,
    });

    expect(result).toMatchObject({ outcome: 'fail', enrich: [] });
  });

  it('should fail a row with no flags', () => {
    expect(judgeRow({ flags: [], verdicts: {}, threshold: 0.6 }).outcome).toBe(
      'fail',
    );
  });
});

describe('tallyJudgeOutcomes', () => {
  it('should count qualified and to_confirm toward the target', () => {
    expect(
      tallyJudgeOutcomes([
        'qualified',
        'to_confirm',
        'unknown',
        'fail',
        'fail',
      ]),
    ).toEqual({
      qualified: 1,
      to_confirm: 1,
      unknown: 1,
      fail: 2,
      towardTarget: 2,
    });
  });
});
