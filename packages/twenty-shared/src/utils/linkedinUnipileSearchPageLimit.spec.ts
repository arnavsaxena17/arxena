import {
    computeLinkedInUnipilePagesRequired,
    getLinkedInUnipileSearchPageLimit,
    LINKEDIN_UNIPILE_CLASSIC_SEARCH_PAGE_LIMIT,
    LINKEDIN_UNIPILE_RECRUITER_SEARCH_PAGE_LIMIT,
    LINKEDIN_UNIPILE_SALES_NAVIGATOR_SEARCH_PAGE_LIMIT,
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
});
