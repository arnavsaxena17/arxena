// How well a person or company fits the user's criteria.
//
// Each criterion is scored pass, fail or unknown. A snapshot is a partial
// profile, so at that stage a criterion it cannot answer is unknown, never
// fail: the row goes on to a profile fetch. On any later stage there is nothing
// left to fetch, so an unknown must-have fails the row.

export type FitmentVerdict = 'pass' | 'fail' | 'unknown';

// A snapshot holds only what a search previews; every later stage holds the
// full evidence (profile, CV, chat, client feedback), so unknown must-haves
// fail there.
export type FitmentStage =
  | 'snapshot'
  | 'profile'
  | 'cv'
  | 'conversation'
  | 'client_feedback';

export type FitmentCriterion = {
  key: string;
  description: string;
  mustHave: boolean;
  weight: number;
  // The answers the model may give. Omit for the plain pass/fail/unknown.
  values?: string[];
  // Which answers count as pass and fail. Any other answer is unknown.
  passValues?: string[];
  failValues?: string[];
};

export type FitmentResult = {
  // 0..1. Snapshot: share of the judged weight that passed. Later stages: share
  // of all weight that passed (unknown counts against the row).
  score: number;
  outcome: FitmentVerdict;
  threshold: number;
  failedMustHaves: string[];
  unknownKeys: string[];
};

const weightOf = (criterion: FitmentCriterion): number =>
  Number.isFinite(criterion.weight) && criterion.weight > 0
    ? criterion.weight
    : 1;

export const isFitmentVerdict = (value: unknown): value is FitmentVerdict =>
  value === 'pass' || value === 'fail' || value === 'unknown';

// A criterion may answer in its own words (same/related/different, exact/
// none). Map that answer onto the score's pass/fail/unknown.
export const toFitmentVerdict = (
  criterion: FitmentCriterion,
  answer: unknown,
): FitmentVerdict => {
  if (isFitmentVerdict(answer)) {
    return answer;
  }

  const value = typeof answer === 'boolean' ? String(answer) : answer;

  if (typeof value !== 'string') {
    return 'unknown';
  }

  if (criterion.passValues?.includes(value) === true) {
    return 'pass';
  }

  if (criterion.failValues?.includes(value) === true) {
    return 'fail';
  }

  return 'unknown';
};

export const scoreFitment = ({
  criteria,
  verdicts,
  stage,
  threshold,
}: {
  criteria: FitmentCriterion[];
  verdicts: Record<string, unknown>;
  stage: FitmentStage;
  threshold: number;
}): FitmentResult => {
  let passWeight = 0;
  let failWeight = 0;
  let unknownWeight = 0;
  const failedMustHaves: string[] = [];
  const unknownKeys: string[] = [];
  const unknownMustHaves: string[] = [];

  for (const criterion of criteria) {
    const weight = weightOf(criterion);
    // A verdict the model did not give is unknown, never a silent fail
    const verdict: FitmentVerdict = isFitmentVerdict(verdicts[criterion.key])
      ? (verdicts[criterion.key] as FitmentVerdict)
      : 'unknown';

    if (verdict === 'pass') {
      passWeight += weight;
    } else if (verdict === 'fail') {
      failWeight += weight;

      if (criterion.mustHave) {
        failedMustHaves.push(criterion.key);
      }
    } else {
      unknownWeight += weight;
      unknownKeys.push(criterion.key);

      if (criterion.mustHave) {
        unknownMustHaves.push(criterion.key);
      }
    }
  }

  const total = passWeight + failWeight + unknownWeight;
  const judged = passWeight + failWeight;
  const denominator = stage === 'snapshot' ? judged : total;
  const score = denominator > 0 ? passWeight / denominator : 0;
  const result = (outcome: FitmentVerdict): FitmentResult => ({
    score,
    outcome,
    threshold,
    failedMustHaves,
    unknownKeys,
  });

  if (failedMustHaves.length > 0 || total === 0) {
    return result('fail');
  }

  if (stage !== 'snapshot') {
    return result(
      unknownMustHaves.length === 0 && score >= threshold ? 'pass' : 'fail',
    );
  }

  // Snapshot: fail only when even answering every unknown in the row's favour
  // would not reach the threshold
  if ((passWeight + unknownWeight) / total < threshold) {
    return result('fail');
  }

  return result(
    unknownWeight > 0 ? 'unknown' : score >= threshold ? 'pass' : 'fail',
  );
};

export const describeFitment = (
  result: FitmentResult,
  criteria: FitmentCriterion[],
): string => {
  const percent = `${Math.round(result.score * 100)}% against ${Math.round(result.threshold * 100)}%`;
  const label = (key: string): string =>
    criteria.find((criterion) => criterion.key === key)?.description ?? key;

  if (result.failedMustHaves.length > 0) {
    return `Fails a must-have: ${result.failedMustHaves.map(label).join('; ')} (${percent})`;
  }

  if (result.unknownKeys.length > 0) {
    return `${result.outcome === 'unknown' ? 'Needs the full profile' : 'Not shown'}: ${result.unknownKeys.map(label).join('; ')} (${percent})`;
  }

  return result.outcome === 'pass'
    ? `Meets the criteria (${percent})`
    : `Below the bar (${percent})`;
};
