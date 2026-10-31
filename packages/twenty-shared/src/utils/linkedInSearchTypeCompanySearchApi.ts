import type { LinkedInSearchType } from '../types/CandidateSearchTypes';

export type LinkedInCompanySearchApi = 'classic' | 'sales_navigator';

/** Map stored member search type to LinkedIn company search API (recruiter → classic). */
export const linkedInSearchTypeToCompanySearchApi = (
  searchType: LinkedInSearchType,
): LinkedInCompanySearchApi =>
  searchType === 'sales_navigator' ? 'sales_navigator' : 'classic';

const SEARCH_TYPE_MISMATCH_HINTS = [
  'sales navigator',
  'sales_nav',
  'not authorized',
  'unauthorized',
  'subscription',
  'premium',
  'invalid product',
  'forbidden',
  'access denied',
  'contract',
  'seat',
] as const;

/** True when a LinkedIn/Unipile error may indicate the wrong search product was used. */
export const isLikelyLinkedInSearchTypeMismatchError = (
  error: unknown,
): boolean => {
  const message =
    error instanceof Error
      ? `${error.message} ${(error as { cause?: unknown }).cause ?? ''}`
      : String(error);
  const lower = message.toLowerCase();
  return SEARCH_TYPE_MISMATCH_HINTS.some((hint) => lower.includes(hint));
};
