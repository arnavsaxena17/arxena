import type { LinkedInSearchType } from '../types/CandidateSearchTypes';

export const LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT = 50;

export const LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT = 100;

export const LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT = 100;

/** Page size for org-chart estimate probes (only paging.total_count is needed). */
export const LINKEDIN_UNIPILE_ESTIMATE_PROBE_PAGE_LIMIT = 10;

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

export const getLinkedInUnipileEstimateProbePageLimit = (): number =>
  LINKEDIN_UNIPILE_ESTIMATE_PROBE_PAGE_LIMIT;

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

/** Randomized Unipile page sizes (`limit` per request) to vary pagination patterns. */
export const LINKEDIN_UNIPILE_RANDOM_PAGE_LIMIT_BUCKETS = [
  [25, 30],
  [50, 60],
  [80, 90],
  [90, 100],
] as const;

const randomIntInclusive = (
  min: number,
  max: number,
  random: () => number,
): number => min + Math.floor(random() * (max - min + 1));

export const pickRandomLinkedInUnipilePageLimit = (
  maxPageSize: number,
  random: () => number = Math.random,
): number => {
  const eligibleBuckets = LINKEDIN_UNIPILE_RANDOM_PAGE_LIMIT_BUCKETS.filter(
    ([min]) => min <= maxPageSize,
  );

  if (eligibleBuckets.length === 0) {
    return maxPageSize;
  }

  const bucketIndex = Math.floor(random() * eligibleBuckets.length);
  const [min, max] = eligibleBuckets[bucketIndex]!;
  const upper = Math.min(max, maxPageSize);
  const lower = Math.min(min, upper);

  return randomIntInclusive(lower, upper, random);
};

/** Build per-request page limits that sum to `desired` (capped by `maxPageSize`). */
export const buildRandomizedLinkedInUnipilePageLimits = (
  desired: number,
  maxPageSize: number,
  random: () => number = Math.random,
): number[] => {
  const total = Math.max(1, Math.floor(desired));
  const limits: number[] = [];
  let remaining = total;

  while (remaining > 0) {
    const pick = pickRandomLinkedInUnipilePageLimit(maxPageSize, random);
    const pageLimit = Math.min(pick, remaining);

    limits.push(pageLimit);
    remaining -= pageLimit;
  }

  return limits;
};
