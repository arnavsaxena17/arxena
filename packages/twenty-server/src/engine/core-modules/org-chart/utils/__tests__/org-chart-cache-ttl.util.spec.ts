import { toOrgChartCacheTtlMs } from '../org-chart-cache-ttl.util';

describe('org-chart-cache-ttl.util', () => {
  it('converts share/publish TTL seconds to Redis milliseconds', () => {
    expect(toOrgChartCacheTtlMs(60 * 60 * 12)).toBe(43_200_000);
  });
});
