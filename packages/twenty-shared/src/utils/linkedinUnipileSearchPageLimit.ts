import type { LinkedInSearchType } from '../types/CandidateSearchTypes';

export const LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT = 50;

export const LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT = 100;

export const LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT = 100;

/**
 * Unipile LinkedIn search API page sizes (`?limit=` on `/api/v1/linkedin/search`).
 * Single source of truth for pagination and page-count estimates.
 */
export const LINKEDIN_UNIPILE_SEARCH_PAGE_LIMITS = {
  classic: LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT,
  sales_navigator: LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT,
  recruiter: LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT,
} as const satisfies Record<LinkedInSearchType, number>;

export const getLinkedInUnipileSearchPageLimit = (
  searchType: LinkedInSearchType,
): number => LINKEDIN_UNIPILE_SEARCH_PAGE_LIMITS[searchType];

export const computeLinkedInUnipilePagesRequired = (input: {
  totalCount?: number;
  maxCandidates: number;
  searchType: LinkedInSearchType;
}): number => {
  const pageSize = getLinkedInUnipileSearchPageLimit(input.searchType);
  const cappedTotal =
    typeof input.totalCount === 'number' && input.totalCount > 0
      ? Math.min(input.totalCount, input.maxCandidates)
      : input.maxCandidates;

  return Math.max(1, Math.ceil(cappedTotal / pageSize));
};
