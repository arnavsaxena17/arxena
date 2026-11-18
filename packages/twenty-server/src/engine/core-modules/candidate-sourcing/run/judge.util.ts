import { createHash } from 'crypto';

import { type FilterFieldSpec } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import {
  scoreFitment,
  type FitmentCriterion,
  type FitmentVerdict,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-score.util';
import {
  type SourcingConstraint,
  type SourcingConstraintField,
  type SourcingSpec,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// One definition of "qualified" (docs/sourcing-loop.md, Judge). The model
// gives a verdict per flag; this file rolls them up and decides nothing else.

export type JudgeFlagKind = 'must_have' | 'nice_to_have' | 'red';

// Who can still answer an unknown: a full profile, the company's web
// presence, or only the candidate
export type JudgeSettledBy = 'profile' | 'company_web' | 'candidate';

// snapshot: a search row. full: the full profile was read.
export type JudgeEvidenceLevel = 'snapshot' | 'full';

export type JudgeFlag = {
  key: string;
  kind: JudgeFlagKind;
  description: string;
  weight: number;
  field: SourcingConstraintField;
  // Used when the model says unknown without naming who can settle it
  defaultSettledBy: JudgeSettledBy;
};

export type JudgeVerdict = {
  verdict: FitmentVerdict;
  settledBy?: JudgeSettledBy;
};

export type JudgeOutcome = 'qualified' | 'unknown' | 'to_confirm' | 'fail';

export type JudgeResult = {
  outcome: JudgeOutcome;
  score: number;
  threshold: number;
  failedMustHaves: string[];
  confirmedRedFlags: string[];
  // Must-haves and red flags still open, and who can settle each
  unsettled: Array<{ key: string; settledBy: JudgeSettledBy }>;
  // Asked of the candidate when the outcome is to_confirm; outreach asks them
  questions: string[];
};

// Each verdict is one enum so Jev, which answers only boolean and enum
// questions, can judge a row in one call
export const JUDGE_ANSWER_VALUES = [
  'pass',
  'fail',
  'unknown',
  'unknown_company_web',
  'unknown_candidate',
] as const;

export const JUDGE_OUTCOME_KEY = 'judgeOutcome';
export const JUDGE_SCORE_KEY = 'judgeScore';
export const JUDGE_LEVEL_KEY = 'judgeLevel';
export const JUDGE_VERDICTS_KEY = 'judgeVerdicts';
export const JUDGE_QUESTIONS_KEY = 'judgeQuestions';

// Rough Jev price per judged row; the triage gate below is in this unit
export const JUDGE_COST_PER_ROW_USD = 0.0005;
// Deterministic triage runs before the judge only when judging every row
// would cost more than this
export const JUDGE_TRIAGE_ABOVE_USD = 2;

export const shouldTriageBeforeJudge = (rowCount: number): boolean =>
  rowCount * JUDGE_COST_PER_ROW_USD > JUDGE_TRIAGE_ABOVE_USD;

// Pay, age and the like only a candidate can confirm; what a company is shows
// on its website; the rest is on the person's profile
const DEFAULT_SETTLED_BY: Partial<
  Record<SourcingConstraintField, JudgeSettledBy>
> = {
  salary: 'candidate',
  age: 'candidate',
  company_type: 'company_web',
  industry: 'company_web',
};

const KIND_PREFIX: Record<JudgeFlagKind, string> = {
  must_have: 'must',
  nice_to_have: 'nice',
  red: 'red',
};

const flagOf = (
  kind: JudgeFlagKind,
  constraint: SourcingConstraint & { weight?: number },
  index: number,
): JudgeFlag => ({
  key: `${KIND_PREFIX[kind]}_${index + 1}_${constraint.field}`,
  kind,
  description:
    kind === 'red' ? `Excluded: ${constraint.userWords}` : constraint.userWords,
  weight:
    constraint.weight !== undefined && constraint.weight > 0
      ? constraint.weight
      : 1,
  field: constraint.field,
  defaultSettledBy:
    kind === 'red'
      ? 'profile'
      : (DEFAULT_SETTLED_BY[constraint.field] ?? 'profile'),
});

export const buildJudgeFlags = (
  spec: Pick<SourcingSpec, 'hard' | 'soft' | 'exclusions'>,
): JudgeFlag[] => [
  ...spec.hard.map((constraint, index) =>
    flagOf('must_have', constraint, index),
  ),
  ...spec.soft.map((constraint, index) =>
    flagOf('nice_to_have', constraint, index),
  ),
  ...spec.exclusions.map((constraint, index) =>
    flagOf('red', constraint, index),
  ),
];

// Identifies what a flag asks, so a cached verdict is reused only for the
// same question
export const judgeFlagHash = (flag: JudgeFlag): string =>
  createHash('sha1')
    .update(`${flag.kind}|${flag.description.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);

const LEVEL_TEXT: Record<JudgeEvidenceLevel, string> = {
  snapshot:
    'You see a search snapshot: name, headline, current title, company and place. Job history, dates, skills and the about text are usually missing.',
  full: 'You see the full profile.',
};

export const buildJudgePrompt = ({
  flags,
  level,
  request,
}: {
  flags: JudgeFlag[];
  level: JudgeEvidenceLevel;
  request?: string;
}): string =>
  [
    request !== undefined && request.trim() !== ''
      ? `The user is looking for: ${request.trim()}`
      : null,
    LEVEL_TEXT[level],
    'Answer every flag on its own:',
    '- pass: the evidence shows it. fail: the evidence shows it does not.',
    "- unknown: a fuller profile could tell. unknown_company_web: the employer's website could tell. unknown_candidate: only the person can tell (pay, notice, relocation, intent).",
    'An "Excluded" flag passes when the person IS excluded. A red flag the evidence cannot show is unknown, never fail.',
    ...flags.map(
      (flag) =>
        `- ${flag.key} (${flag.kind === 'red' ? 'red flag' : flag.kind === 'must_have' ? 'must-have' : 'nice-to-have'}): ${flag.description}`,
    ),
    'A title, company or place the person used to hold is not current.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

export const buildJudgeModelFields = (flags: JudgeFlag[]): FilterFieldSpec[] =>
  flags.map((flag) => ({
    name: flag.key,
    type: 'enum',
    enumValues: [...JUDGE_ANSWER_VALUES],
    description: flag.description,
  }));

export const parseJudgeAnswer = (value: unknown): JudgeVerdict => {
  switch (value) {
    case 'pass':
      return { verdict: 'pass' };
    case 'fail':
      return { verdict: 'fail' };
    case 'unknown_company_web':
      return { verdict: 'unknown', settledBy: 'company_web' };
    case 'unknown_candidate':
      return { verdict: 'unknown', settledBy: 'candidate' };
    default:
      return { verdict: 'unknown' };
  }
};

const questionOf = (flag: JudgeFlag): string =>
  flag.kind === 'red'
    ? `Can you confirm this does not apply: ${flag.description.replace(/^Excluded: /, '')}?`
    : `Can you confirm: ${flag.description}?`;

// The row outcome. A confirmed red flag or a failed must-have ends the row at
// any level and is never weighed against a strong profile. An open flag goes
// to whoever can still settle it: the next evidence level, the company's
// website, or the candidate. A level already tried cannot settle anything.
export const rollUpJudgement = ({
  flags,
  verdicts,
  level,
  threshold,
  triedLevels = [],
}: {
  flags: JudgeFlag[];
  verdicts: Record<string, JudgeVerdict | undefined>;
  level: JudgeEvidenceLevel;
  threshold: number;
  // Enrichment already done for this row (company_web)
  triedLevels?: JudgeSettledBy[];
}): JudgeResult => {
  const verdictOf = (flag: JudgeFlag): JudgeVerdict =>
    verdicts[flag.key] ?? { verdict: 'unknown' };
  const failedMustHaves: string[] = [];
  const confirmedRedFlags: string[] = [];
  const unsettled: JudgeResult['unsettled'] = [];
  const questions: string[] = [];

  for (const flag of flags) {
    const { verdict, settledBy } = verdictOf(flag);

    if (flag.kind === 'must_have' && verdict === 'fail') {
      failedMustHaves.push(flag.key);
    }

    if (flag.kind === 'red' && verdict === 'pass') {
      confirmedRedFlags.push(flag.key);
    }

    if (flag.kind === 'nice_to_have' || verdict !== 'unknown') {
      continue;
    }

    let who = settledBy ?? flag.defaultSettledBy;

    // The full profile was read and still did not say. A must-have the
    // profile should show fails, as it always has; a red flag it cannot show
    // is asked of the candidate rather than assumed clear.
    if (who === 'profile' && level === 'full') {
      if (flag.kind === 'must_have') {
        failedMustHaves.push(flag.key);
        continue;
      }

      who = 'candidate';
    }

    if (who === 'company_web' && triedLevels.includes('company_web')) {
      who = 'candidate';
    }

    unsettled.push({ key: flag.key, settledBy: who });

    if (who === 'candidate') {
      questions.push(questionOf(flag));
    }
  }

  const scored = flags.filter((flag) => flag.kind !== 'red');
  const fitment =
    scored.length === 0
      ? undefined
      : scoreFitment({
          criteria: scored.map(
            (flag): FitmentCriterion => ({
              key: flag.key,
              description: flag.description,
              mustHave: flag.kind === 'must_have',
              weight: flag.weight,
            }),
          ),
          verdicts: Object.fromEntries(
            scored.map((flag) => [flag.key, verdictOf(flag).verdict]),
          ),
          stage: 'snapshot',
          threshold,
        });
  const score = fitment?.score ?? 1;
  const result = (outcome: JudgeOutcome): JudgeResult => ({
    outcome,
    score,
    threshold,
    failedMustHaves,
    confirmedRedFlags,
    unsettled,
    questions: outcome === 'to_confirm' ? questions : [],
  });

  if (
    failedMustHaves.length > 0 ||
    confirmedRedFlags.length > 0 ||
    fitment?.outcome === 'fail'
  ) {
    return result('fail');
  }

  if (unsettled.some((open) => open.settledBy !== 'candidate')) {
    return result('unknown');
  }

  if (unsettled.length > 0) {
    return result('to_confirm');
  }

  return result(score >= threshold ? 'qualified' : 'fail');
};

// What the stop rules count toward the target
export const countsTowardTarget = (outcome: JudgeOutcome): boolean =>
  outcome === 'qualified' || outcome === 'to_confirm';
