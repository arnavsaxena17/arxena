import {
    normalizeCompanyId,
    normalizeCompanyName,
} from './orgchart-normalization.util';

export const ORG_CHART_COMPANY_CACHE_KEY_PREFIX = 'company-orgchart';
export const ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX =
  'company-orgchart-candidates';

/** Redis namespace prefix for {@link CacheStorageNamespace.EngineOrgChart}. */
export const ENGINE_ORG_CHART_REDIS_NAMESPACE = 'engine:org-chart';

export function buildCompanyOrgChartLogicalCacheKey(
  companyName: string | undefined,
  companyId: string | undefined,
  mode: 'entire_company',
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  sourceTag?: string,
): string {
  const normalizedCompanyName = normalizeCompanyName(companyName);
  const normalizedCompanyId = normalizeCompanyId(
    companyId,
    normalizedCompanyName,
  );

  const normalizedSourceTag =
    typeof sourceTag === 'string'
      ? sourceTag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      : '';

  return [
    ORG_CHART_COMPANY_CACHE_KEY_PREFIX,
    normalizedCompanyId,
    mode,
    searchType,
    normalizedSourceTag || 'default',
  ].join(':');
}

export function buildCompanyOrgChartCandidateListLogicalCacheKey(
  companyName: string | undefined,
  companyId: string | undefined,
  mode: 'entire_company',
  searchType: 'classic' | 'sales_navigator' | 'recruiter',
  sourceTag?: string,
): string {
  const normalizedCompanyName = normalizeCompanyName(companyName);
  const normalizedCompanyId = normalizeCompanyId(
    companyId,
    normalizedCompanyName,
  );

  const normalizedSourceTag =
    typeof sourceTag === 'string'
      ? sourceTag.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      : '';

  return [
    ORG_CHART_COMPANY_CANDIDATE_LIST_CACHE_KEY_PREFIX,
    normalizedCompanyId,
    mode,
    searchType,
    normalizedSourceTag || 'default',
  ].join(':');
}

export function fullEngineOrgChartRedisKey(logicalKey: string): string {
  return `${ENGINE_ORG_CHART_REDIS_NAMESPACE}:${logicalKey}`;
}
