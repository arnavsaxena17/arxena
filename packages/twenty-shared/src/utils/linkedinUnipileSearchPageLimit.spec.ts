import {
  buildRandomizedLinkedInUnipilePageLimits,
  computeLinkedInUnipilePagesRequired,
  getLinkedInUnipileEstimateProbePageLimit,
  getLinkedInUnipileSearchPageLimit,
  LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT,
  LINKEDIN_UNIPILE_ESTIMATE_PROBE_PAGE_LIMIT,
  LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT,
  LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT,
  pickRandomLinkedInUnipilePageLimit,
} from './linkedinUnipileSearchPageLimit';

describe('linkedinUnipileSearchPageLimit', () => {
  it('exposes canonical Unipile page limits per search type', () => {
    expect(LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT).toBe(50);
    expect(LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT).toBe(100);
    expect(LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT).toBe(100);
    expect(getLinkedInUnipileSearchPageLimit('sales_navigator')).toBe(
      LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT,
    );
    expect(getLinkedInUnipileSearchPageLimit('recruiter')).toBe(
      LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT,
    );
    expect(getLinkedInUnipileSearchPageLimit('classic')).toBe(
      LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT,
    );
  });

  it('returns page limit for each search type', () => {
    expect(getLinkedInUnipileSearchPageLimit('classic')).toBe(50);
    expect(getLinkedInUnipileSearchPageLimit('sales_navigator')).toBe(100);
    expect(getLinkedInUnipileSearchPageLimit('recruiter')).toBe(100);
  });

  it('exposes a smaller probe page limit for org-chart estimates', () => {
    expect(LINKEDIN_UNIPILE_ESTIMATE_PROBE_PAGE_LIMIT).toBe(10);
    expect(getLinkedInUnipileEstimateProbePageLimit()).toBe(10);
  });

  it('computes pages required from total count and cap', () => {
    expect(
      computeLinkedInUnipilePagesRequired({
        totalCount: 250,
        maxCandidates: 500,
        searchType: 'sales_navigator',
      }),
    ).toBe(3);

    expect(
      computeLinkedInUnipilePagesRequired({
        totalCount: 120,
        maxCandidates: 500,
        searchType: 'classic',
      }),
    ).toBe(3);

    expect(
      computeLinkedInUnipilePagesRequired({
        totalCount: 2000,
        maxCandidates: 500,
        searchType: 'recruiter',
      }),
    ).toBe(5);
  });

  it('returns at least one page when total count is unknown', () => {
    expect(
      computeLinkedInUnipilePagesRequired({
        maxCandidates: 500,
        searchType: 'classic',
      }),
    ).toBe(10);
  });

  it('builds randomized page limits that sum to the requested total', () => {
    let call = 0;
    const random = () => {
      const values = [0.1, 0.6, 0.85, 0.95, 0.2, 0.55, 0.9, 0.98];
      const value = values[call % values.length] ?? 0.5;

      call += 1;

      return value;
    };

    const limits = buildRandomizedLinkedInUnipilePageLimits(500, 100, random);

    expect(limits.reduce((sum, limit) => sum + limit, 0)).toBe(500);
    expect(limits.every((limit) => limit > 0 && limit <= 100)).toBe(true);
    expect(limits.length).toBeGreaterThan(1);
  });

  it('picks page limits from eligible buckets for classic search', () => {
    const limits = new Set<number>();

    for (let index = 0; index < 50; index += 1) {
      limits.add(pickRandomLinkedInUnipilePageLimit(50));
    }

    expect([...limits].every((limit) => limit >= 25 && limit <= 50)).toBe(
      true,
    );
    expect(limits.has(80)).toBe(false);
  });
});
