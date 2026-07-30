/* @license Enterprise */

/** Default spend: 1 API credit per People API search call. */
export const DEFAULT_API_SEARCH_CREDIT_COST = 1;

export const getApiSearchCreditCost = (): number => {
  const raw = process.env.CREDIT_COST_API_SEARCH;
  if (raw !== undefined) {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_API_SEARCH_CREDIT_COST;
};

export const FREE_SIGNUP_API_CREDITS = 10;
