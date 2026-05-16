/**
 * cache-manager-redis-yet passes TTL to Redis PX (milliseconds).
 * Call sites use seconds (share/publish TTL, ORG_CHART_COMPANY_CACHE_TTL_SECONDS).
 */
export const toOrgChartCacheTtlMs = (ttlSeconds: number): number =>
  Math.max(1, Math.floor(ttlSeconds)) * 1000;
