import {
  buildJudgeFlags,
  buildJudgeModelFields,
  judgeFlagHash,
  parseJudgeAnswer,
  rollUpJudgement,
  shouldTriageBeforeJudge,
  type JudgeVerdict,
} from 'src/engine/core-modules/candidate-sourcing/run/judge.util';
import { type SourcingConstraint } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

const constraint = (
  field: SourcingConstraint['field'],
  userWords: string,
): SourcingConstraint => ({
  field,
  userWords,
  normalized: [userWords.toLowerCase()],
});

const flags = buildJudgeFlags({
  hard: [
    constraint('title', 'Plant head'),
    constraint('salary', 'under 40 LPA'),
  ],
  soft: [constraint('skill', 'SAP PP')],
  exclusions: [constraint('company', 'Tata Chemicals')],
});
const [title, salary, sap, tata] = flags.map((flag) => flag.key);

const judge = (
  verdicts: Record<string, JudgeVerdict>,
  level: 'snapshot' | 'full' = 'snapshot',
  triedLevels: Array<'company_web'> = [],
) =>
  rollUpJudgement({
    flags,
    verdicts,
    level,
    threshold: 0.5,
    triedLevels,
  });

const pass: JudgeVerdict = { verdict: 'pass' };
const fail: JudgeVerdict = { verdict: 'fail' };
const unknown: JudgeVerdict = { verdict: 'unknown' };

describe('buildJudgeFlags', () => {
  it('should turn hard, soft and exclusions into must, nice and red flags', () => {
    expect(
      flags.map((flag) => [flag.key, flag.kind, flag.defaultSettledBy]),
    ).toEqual([
      ['must_1_title', 'must_have', 'profile'],
      ['must_2_salary', 'must_have', 'candidate'],
      ['nice_1_skill', 'nice_to_have', 'profile'],
      ['red_1_company', 'red', 'profile'],
    ]);
    expect(flags[3].description).toBe('Excluded: Tata Chemicals');
  });

  it('should ask one enum per flag and hash a flag by its question', () => {
    expect(buildJudgeModelFields(flags)[0].enumValues).toContain(
      'unknown_candidate',
    );
    expect(judgeFlagHash(flags[0])).toBe(
      judgeFlagHash({ ...flags[0], key: 'other' }),
    );
    expect(judgeFlagHash(flags[0])).not.toBe(judgeFlagHash(flags[1]));
  });

  it('should read the settled-by answers', () => {
    expect(parseJudgeAnswer('unknown_company_web')).toEqual({
      verdict: 'unknown',
      settledBy: 'company_web',
    });
    expect(parseJudgeAnswer('maybe')).toEqual({ verdict: 'unknown' });
  });
});

describe('rollUpJudgement', () => {
  it('should qualify a row with every must-have and red flag settled', () => {
    expect(
      judge({ [title]: pass, [salary]: pass, [sap]: pass, [tata]: fail })
        .outcome,
    ).toBe('qualified');
  });

  it('should fail on a confirmed red flag however strong the row', () => {
    const result = judge({
      [title]: pass,
      [salary]: pass,
      [sap]: pass,
      [tata]: pass,
    });

    expect(result.outcome).toBe('fail');
    expect(result.confirmedRedFlags).toEqual([tata]);
  });

  it('should send a profile-level unknown to enrichment on a snapshot', () => {
    const result = judge({ [title]: unknown, [salary]: pass, [tata]: fail });

    expect(result.outcome).toBe('unknown');
    expect(result.unsettled).toEqual([{ key: title, settledBy: 'profile' }]);
  });

  it('should fail a must-have the full profile still does not show', () => {
    expect(
      judge({ [title]: unknown, [salary]: pass, [tata]: fail }, 'full').outcome,
    ).toBe('fail');
  });

  it('should leave the loop as to_confirm when only the candidate can answer', () => {
    const result = judge(
      { [title]: pass, [salary]: unknown, [sap]: pass, [tata]: unknown },
      'full',
    );

    expect(result.outcome).toBe('to_confirm');
    expect(result.questions).toEqual([
      'Can you confirm: under 40 LPA?',
      'Can you confirm this does not apply: Tata Chemicals?',
    ]);
  });

  it('should hand a company-web unknown to the candidate once the web was tried', () => {
    const verdicts = {
      [title]: { verdict: 'unknown', settledBy: 'company_web' } as JudgeVerdict,
      [salary]: pass,
      [tata]: fail,
    };

    expect(judge(verdicts).outcome).toBe('unknown');
    expect(judge(verdicts, 'snapshot', ['company_web']).outcome).toBe(
      'to_confirm',
    );
  });

  it('should never let a nice-to-have block a row', () => {
    expect(
      judge({ [title]: pass, [salary]: pass, [sap]: unknown, [tata]: fail })
        .outcome,
    ).toBe('qualified');
  });
});

describe('shouldTriageBeforeJudge', () => {
  it('should triage only when judging every row passes $2', () => {
    expect(shouldTriageBeforeJudge(4_000)).toBe(false);
    expect(shouldTriageBeforeJudge(4_001)).toBe(true);
  });
});
