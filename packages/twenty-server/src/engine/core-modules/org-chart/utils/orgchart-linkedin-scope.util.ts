import { hasMeaningfulOrgChartFunctionRootFilter } from './orgchart-filter.util';

const DEFAULT_ORGCHART_LINKEDIN_PAGE_SIZE = 10;

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

export const getOrgChartLinkedInPageSize = (): number =>
  DEFAULT_ORGCHART_LINKEDIN_PAGE_SIZE;

export const computeOrgChartLinkedInMaxPages = (
  totalCount: number | undefined,
  maxCandidates: number,
  pageSize = DEFAULT_ORGCHART_LINKEDIN_PAGE_SIZE,
): number => {
  const cappedTotal =
    typeof totalCount === 'number' && totalCount > 0
      ? Math.min(totalCount, maxCandidates)
      : maxCandidates;

  return Math.max(1, Math.ceil(cappedTotal / pageSize));
};

export const computeOrgChartLinkedInSearchPlan = (input: {
  totalCountFromApi: number;
  strategiesToRun: number;
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
} => {
  const pageSize = input.pageSize ?? DEFAULT_ORGCHART_LINKEDIN_PAGE_SIZE;
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
    pageSize,
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
