import {
  isFitmentVerdict,
  type FitmentVerdict,
} from 'src/domains/ingestion/candidate-sourcing/services/fitment/fitment-score.util';

// The model scores each flag. This file turns those verdicts into the row
// outcome, and is the one definition of "qualified".

export type JudgeSettledBy = 'profile' | 'company_web' | 'candidate';

export type JudgeFlagKind = 'must_have' | 'nice_to_have' | 'red';

export type JudgeFlag = {
  key: string;
  description: string;
  kind: JudgeFlagKind;
  // Green flags only; a red flag is never weighed
  weight?: number;
};

export type JudgeFlagVerdict = {
  // For a red flag pass means cleared and fail means it is there
  verdict: FitmentVerdict;
  // What would settle an unknown
  settledBy?: JudgeSettledBy;
  // What to ask when only the candidate can settle it
  question?: string;
};

// What the row already carries, so a level that was bought is not bought again
export type JudgeEvidence = {
  hasProfile: boolean;
  hasCompanyWeb: boolean;
};

export type JudgeOutcome = 'qualified' | 'unknown' | 'to_confirm' | 'fail';

export type JudgeEnrichLevel = Exclude<JudgeSettledBy, 'candidate'>;

export type JudgeResult = {
  outcome: JudgeOutcome;
  // 0..1: share of the green weight that passed
  score: number;
  threshold: number;
  // Must-haves that failed and red flags that are there
  failedKeys: string[];
  unknownKeys: string[];
  // What to buy for an unknown row, cheapest first
  enrich: JudgeEnrichLevel[];
  // What to ask a to_confirm row
  questions: Array<{ key: string; question: string }>;
};

const ENRICH_ORDER: JudgeEnrichLevel[] = ['profile', 'company_web'];

const weightOf = (flag: JudgeFlag): number =>
  flag.weight !== undefined && Number.isFinite(flag.weight) && flag.weight > 0
    ? flag.weight
    : 1;

const isSettledBy = (value: unknown): value is JudgeSettledBy =>
  value === 'profile' || value === 'company_web' || value === 'candidate';

// A verdict the model did not give is unknown, never a silent fail. A bare
// "pass" is accepted next to the full object.
const readVerdict = (value: unknown): JudgeFlagVerdict => {
  if (isFitmentVerdict(value)) {
    return { verdict: value };
  }

  if (typeof value !== 'object' || value === null) {
    return { verdict: 'unknown' };
  }

  const record = value as Record<string, unknown>;
  const question =
    typeof record.question === 'string' && record.question.trim() !== ''
      ? record.question.trim()
      : undefined;

  return {
    verdict: isFitmentVerdict(record.verdict) ? record.verdict : 'unknown',
    ...(isSettledBy(record.settledBy) && { settledBy: record.settledBy }),
    ...(question !== undefined && { question }),
  };
};

// Where an unknown goes. 'spent' means the level that could have shown it is
// already on the row and did not: there is nothing left to buy for it.
const levelOf = (
  settledBy: JudgeSettledBy | undefined,
  evidence: JudgeEvidence,
): JudgeSettledBy | 'spent' => {
  const level = settledBy ?? 'profile';

  if (level === 'profile' && evidence.hasProfile) {
    return 'spent';
  }

  if (level === 'company_web' && evidence.hasCompanyWeb) {
    return 'spent';
  }

  return level;
};

export const judgeRow = ({
  flags,
  verdicts,
  threshold,
  evidence = { hasProfile: false, hasCompanyWeb: false },
}: {
  flags: JudgeFlag[];
  verdicts: Record<string, unknown>;
  threshold: number;
  evidence?: JudgeEvidence;
}): JudgeResult => {
  let greenWeight = 0;
  let passWeight = 0;
  // Must-haves still open: they count for the row when asking whether it can
  // still reach the threshold
  let openWeight = 0;
  const failedKeys: string[] = [];
  const unknownKeys: string[] = [];
  const enrich = new Set<JudgeEnrichLevel>();
  const questions: Array<{ key: string; question: string }> = [];

  for (const flag of flags) {
    const { verdict, settledBy, question } = readVerdict(verdicts[flag.key]);
    const isGreen = flag.kind !== 'red';
    const weight = isGreen ? weightOf(flag) : 0;

    greenWeight += weight;

    if (verdict === 'pass') {
      passWeight += weight;
      continue;
    }

    if (flag.kind === 'nice_to_have') {
      // Ranks the row and never blocks it: an unknown scores like a fail and
      // is never worth an enrichment on its own
      if (verdict === 'unknown') {
        unknownKeys.push(flag.key);
      }
      continue;
    }

    if (verdict === 'fail') {
      failedKeys.push(flag.key);
      continue;
    }

    unknownKeys.push(flag.key);

    const level = levelOf(settledBy, evidence);

    if (level === 'spent' && flag.kind === 'must_have') {
      // The source that could have shown it was read and does not show it
      failedKeys.push(flag.key);
      continue;
    }

    openWeight += weight;

    if (level === 'spent' || level === 'candidate') {
      // A red flag the evidence cannot show is unseen, not cleared: with
      // nothing left to buy, only the candidate can clear it
      questions.push({
        key: flag.key,
        question: question ?? `Please confirm: ${flag.description}`,
      });
      continue;
    }

    enrich.add(level);
  }

  const score = greenWeight > 0 ? passWeight / greenWeight : 1;
  const bestScore =
    greenWeight > 0 ? (passWeight + openWeight) / greenWeight : 1;
  const result = (outcome: JudgeOutcome): JudgeResult => ({
    outcome,
    score,
    threshold,
    failedKeys,
    unknownKeys,
    enrich:
      outcome === 'unknown'
        ? ENRICH_ORDER.filter((level) => enrich.has(level))
        : [],
    questions: outcome === 'to_confirm' ? questions : [],
  });

  // A confirmed red flag or a failed must-have is terminal at any level, and
  // is never weighed against a strong profile
  if (flags.length === 0 || failedKeys.length > 0) {
    return result('fail');
  }

  // Not worth settling: every open item going the row's way still falls short
  if (bestScore < threshold) {
    return result('fail');
  }

  if (enrich.size > 0) {
    return result('unknown');
  }

  if (questions.length > 0) {
    return result('to_confirm');
  }

  return result(score >= threshold ? 'qualified' : 'fail');
};

export type JudgeTally = Record<JudgeOutcome, number> & {
  // What the stop rules read: qualified + to_confirm
  towardTarget: number;
};

export const tallyJudgeOutcomes = (outcomes: JudgeOutcome[]): JudgeTally => {
  const tally: JudgeTally = {
    qualified: 0,
    unknown: 0,
    to_confirm: 0,
    fail: 0,
    towardTarget: 0,
  };

  for (const outcome of outcomes) {
    tally[outcome] += 1;
  }

  tally.towardTarget = tally.qualified + tally.to_confirm;

  return tally;
};
