import {
  getOrgChartUnipileUnlimitedMaxCandidatesPerShard,
  ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD,
  randomOrgChartUnipileUnlimitedRequestDelayMs,
} from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';
import { computeOrgChartLinkedInSearchPlan } from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';

describe('orgchart unipile unlimited scope helpers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults unlimited max per shard to 2500', () => {
    delete process.env.ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD;
    expect(getOrgChartUnipileUnlimitedMaxCandidatesPerShard()).toBe(
      ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD,
    );
    expect(ORGCHART_UNIPILE_UNLIMITED_MAX_CANDIDATES_PER_SHARD).toBe(2500);
  });

  it('returns random delay in 30–120s range by default', () => {
    delete process.env.ORGCHART_UNIPILE_UNLIMITED_REQUEST_DELAY_MS_MIN;
    delete process.env.ORGCHART_UNIPILE_UNLIMITED_REQUEST_DELAY_MS_MAX;
    for (let index = 0; index < 20; index++) {
      const delayMs = randomOrgChartUnipileUnlimitedRequestDelayMs();
      expect(delayMs).toBeGreaterThanOrEqual(30_000);
      expect(delayMs).toBeLessThanOrEqual(120_000);
    }
  });

  it('scopeRequired is still true without unlimited when over threshold', () => {
    const plan = computeOrgChartLinkedInSearchPlan({
      totalCountFromApi: 4000,
      strategiesToRun: 1,
      searchType: 'sales_navigator',
      maxCandidates: 1000,
    });

    expect(plan.scopeRequired).toBe(true);
    expect(plan.thresholdExceeded).toBe(true);
  });
});
