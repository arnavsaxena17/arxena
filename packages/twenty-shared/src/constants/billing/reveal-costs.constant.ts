/* @license Enterprise */

export type RevealKind = 'email' | 'phone';

export const DEFAULT_REVEAL_COSTS: Record<RevealKind, number> = {
  email: 1,
  phone: 5,
};

const ENV_KEY: Record<RevealKind, string> = {
  email: 'CREDIT_COST_EMAIL_REVEAL',
  phone: 'CREDIT_COST_PHONE_REVEAL',
};

const readNumericEnv = (key: string): number | null => {
  const raw =
    typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
};

/**
 * Cost of revealing one piece of contact data (in unified reveal credits).
 * Reads CREDIT_COST_EMAIL_REVEAL / CREDIT_COST_PHONE_REVEAL env vars at
 * runtime so operators can retune (e.g. 1:8 instead of 1:5) without code
 * changes — copy on the marketing site, in-app balance equivalents, and the
 * server-side debit logic all pick up the new value automatically.
 */
export const getRevealCost = (kind: RevealKind): number => {
  const fromEnv = readNumericEnv(ENV_KEY[kind]);
  return fromEnv ?? DEFAULT_REVEAL_COSTS[kind];
};

/**
 * Compute the total reveal-credit cost for a batch of email + phone reveals.
 */
export const computeRevealCreditCost = (input: {
  emails?: number;
  phones?: number;
}): number => {
  const emails = Math.max(0, input.emails ?? 0);
  const phones = Math.max(0, input.phones ?? 0);
  return emails * getRevealCost('email') + phones * getRevealCost('phone');
};
