export type EngagementPlan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  period: string;
  interval: number;
};

/**
 * Returns up to `limit` plans for display on the billing page.
 * Picks lowest (entry), middle, and highest price tiers.
 * Prefers monthly plans when duplicates exist (same name, different period).
 */
export const getDisplayPlans = (
  plans: EngagementPlan[],
  limit = 3,
): EngagementPlan[] => {
  if (plans.length <= limit) {
    return plans;
  }
  const monthly = plans.filter((p) => p.period === 'monthly');
  const source = monthly.length >= limit ? monthly : plans;
  const len = source.length;
  if (len <= limit) {
    return source;
  }
  const first = 0;
  const middle = Math.floor(len / 2);
  const last = len - 1;
  const indices = [first, middle, last];
  return indices.map((i) => source[i]);
};
