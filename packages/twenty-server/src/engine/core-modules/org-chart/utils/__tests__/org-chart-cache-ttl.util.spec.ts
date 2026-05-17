import {
    isOrgPublishForeverTtl,
    resolveOrgChartPublishCacheTtlMs,
    toOrgChartCacheTtlMs,
} from '../org-chart-cache-ttl.util';

describe('org-chart-cache-ttl.util', () => {
  it('converts share/publish TTL seconds to Redis milliseconds', () => {
    expect(toOrgChartCacheTtlMs(60 * 60 * 12)).toBe(43_200_000);
  });

  it('treats ttlSeconds 0 as forever publish TTL', () => {
    expect(isOrgPublishForeverTtl(0)).toBe(true);
    expect(resolveOrgChartPublishCacheTtlMs(0)).toBeUndefined();
  });

  it('resolves timed publish TTL to milliseconds', () => {
    expect(resolveOrgChartPublishCacheTtlMs(60)).toBe(60_000);
  });
});
