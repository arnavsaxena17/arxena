/** Published brand slug mapping: no Redis expiry until republished or slug replaced. */
export const ORG_PUBLISH_FOREVER_TTL_SECONDS = 0;

export const ORG_PUBLISH_MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * cache-manager-redis-yet passes TTL to Redis PX (milliseconds).
 * Call sites use seconds (share/publish TTL, ORG_CHART_COMPANY_CACHE_TTL_SECONDS).
 */
export const toOrgChartCacheTtlMs = (ttlSeconds: number): number =>
  Math.max(1, Math.floor(ttlSeconds)) * 1000;

export const isOrgPublishForeverTtl = (ttlSeconds: number): boolean =>
  ttlSeconds === ORG_PUBLISH_FOREVER_TTL_SECONDS;

/** Omit TTL for forever publish; otherwise convert seconds to Redis milliseconds. */
export const resolveOrgChartPublishCacheTtlMs = (
  ttlSeconds: number,
): number | undefined => {
  if (isOrgPublishForeverTtl(ttlSeconds)) {
    return undefined;
  }

  return toOrgChartCacheTtlMs(ttlSeconds);
};
