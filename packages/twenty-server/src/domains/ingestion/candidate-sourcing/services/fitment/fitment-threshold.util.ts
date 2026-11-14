export const FITMENT_THRESHOLD_ENV = 'SOURCING_FITMENT_THRESHOLD';
export const DEFAULT_FITMENT_THRESHOLD = 0.5;

// Each yes/no judgement the sourcing agent relies on has its own bar, because
// the cost of a wrong answer differs: a missed fit loses a person, a wrong
// "fake" only moves a row down the table, and a wrong "same person" merges two
// real people and deletes one. Raise the last one before the others.
export const FAKE_PROFILE_THRESHOLD_ENV = 'SOURCING_FAKE_PROFILE_THRESHOLD';
export const SAME_PERSON_THRESHOLD_ENV = 'SOURCING_SAME_PERSON_THRESHOLD';
export const DEFAULT_FAKE_PROFILE_THRESHOLD = 0.5;
export const DEFAULT_SAME_PERSON_THRESHOLD = 0.5;

// "0.6", "60" and "60%" all mean 60%. A value that is not a number in (0, 100]
// is ignored, so a typo in the env never switches the bar off.
const parseThreshold = (raw: string | undefined): number | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  const value = Number.parseFloat(raw.trim().replace(/%$/, ''));

  if (!Number.isFinite(value) || value <= 0 || value > 100) {
    return undefined;
  }

  return value > 1 ? value / 100 : value;
};

// Probability at which the judge's "this profile looks fabricated" counts
export const getFakeProfileThreshold = (
  env: Record<string, string | undefined> = process.env,
): number =>
  parseThreshold(env[FAKE_PROFILE_THRESHOLD_ENV]) ??
  DEFAULT_FAKE_PROFILE_THRESHOLD;

// Probability at which "these two rows are one person" merges them
export const getSamePersonThreshold = (
  env: Record<string, string | undefined> = process.env,
): number =>
  parseThreshold(env[SAME_PERSON_THRESHOLD_ENV]) ??
  DEFAULT_SAME_PERSON_THRESHOLD;

// The minimum fitment score for a row to count toward a sourcing target. Set
// in the server env; this is the only place that reads it.
export const getFitmentThreshold = (
  env: Record<string, string | undefined> = process.env,
): number =>
  parseThreshold(env[FITMENT_THRESHOLD_ENV]) ?? DEFAULT_FITMENT_THRESHOLD;

// A request may raise the bar, never lower it below the server's.
export const resolveFitmentThreshold = (
  requested?: number,
  env: Record<string, string | undefined> = process.env,
): number => {
  const floor = getFitmentThreshold(env);

  return requested !== undefined && Number.isFinite(requested)
    ? Math.min(1, Math.max(floor, requested))
    : floor;
};
