import type { LinkedInSearchType } from 'twenty-shared';
import {
  computeLinkedInUnipilePagesRequired,
  getLinkedInUnipileSearchPageLimit,
} from 'twenty-shared';

import { hasMeaningfulOrgChartFunctionRootFilter } from './orgchart-filter.util';

export {
  computeLinkedInUnipilePagesRequired,
  getLinkedInUnipileSearchPageLimit,
  LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT,
  LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT,
  LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT,
  LINKEDIN_UNIPILE_SEARCH_PAGE_LIMITS
} from 'twenty-shared';

export const hasMeaningfulOrgChartCountryFilter = (
  country?: string,
): boolean => {
  const normalized = (country ?? '').trim().toLowerCase();

  return normalized.length > 0 && normalized !== 'global';
};

export const hasOrgChartLinkedInSubsetScopeFilter = (
  country?: string,
  functionRoot?: string,
): boolean =>
  hasMeaningfulOrgChartCountryFilter(country) ||
  hasMeaningfulOrgChartFunctionRootFilter(functionRoot);

export const getOrgChartLinkedInMaxCandidates = (): number => {
  const raw = Number(
    process.env.ORGCHART_MAX_LINKEDIN_CANDIDATES ??
      process.env.SUPER_IMPOSE_MAX_CANDIDATES ??
      '500',
  );

  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 500;
};

export const getOrgChartLinkedInPageSize = (
  searchType: LinkedInSearchType,
): number => getLinkedInUnipileSearchPageLimit(searchType);

export const computeOrgChartLinkedInMaxPages = (
  totalCount: number | undefined,
  maxCandidates: number,
  searchType: LinkedInSearchType,
): number =>
  computeLinkedInUnipilePagesRequired({
    totalCount,
    maxCandidates,
    searchType,
  });

export const computeOrgChartLinkedInSearchPlan = (input: {
  totalCountFromApi: number;
  strategiesToRun: number;
  searchType: LinkedInSearchType;
  country?: string;
  functionRoot?: string;
  pageSize?: number;
  maxCandidates?: number;
}): {
  threshold: number;
  estimatedTotalUpperBound: number;
  estimatedTotal: number;
  estimatedApiRequests: number;
  thresholdExceeded: boolean;
  scopeRequired: boolean;
  maxPages: number;
  maxCandidates: number;
  pageSize: number;
} => {
  const pageSize =
    input.pageSize ?? getLinkedInUnipileSearchPageLimit(input.searchType);
  const maxCandidates = input.maxCandidates ?? getOrgChartLinkedInMaxCandidates();
  const strategiesToRun = Math.max(1, input.strategiesToRun);
  const totalCount = Math.max(0, input.totalCountFromApi);
  const hasScope = hasOrgChartLinkedInSubsetScopeFilter(
    input.country,
    input.functionRoot,
  );
  const threshold = maxCandidates;
  const estimatedTotalUpperBound = totalCount;
  const estimatedTotal = Math.min(totalCount, maxCandidates);
  const maxPages = computeOrgChartLinkedInMaxPages(
    totalCount,
    maxCandidates,
    input.searchType,
  );
  const estimatedApiRequests = strategiesToRun * maxPages;
  const thresholdExceeded = totalCount > threshold;
  const scopeRequired = thresholdExceeded && !hasScope;

  return {
    threshold,
    estimatedTotalUpperBound,
    estimatedTotal,
    estimatedApiRequests,
    thresholdExceeded,
    scopeRequired,
    maxPages,
    maxCandidates,
    pageSize,
  };
};

export const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const randomOrgChartLinkedInPageDelayMs = (): number => {
  const minRaw = Number(process.env.ORGCHART_LINKEDIN_PAGE_DELAY_MS_MIN ?? '2000');
  const maxRaw = Number(process.env.ORGCHART_LINKEDIN_PAGE_DELAY_MS_MAX ?? '3000');
  const min = Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : 2000;
  const max = Number.isFinite(maxRaw) && maxRaw >= min ? maxRaw : Math.max(min, 3000);

  return min + Math.floor(Math.random() * (max - min + 1));
};
