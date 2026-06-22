import {
    hasMeaningfulLinkedInLocationIdFilter,
    hasOrgChartLinkedInLeadershipOnlyFilter,
    hasOrgChartLinkedInSubsetScopeFilter,
} from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';

describe('orgchart-linkedin-scope.util', () => {
  it('treats linkedin location id as a scope filter', () => {
    expect(hasMeaningfulLinkedInLocationIdFilter('102713980')).toBe(true);
    expect(hasMeaningfulLinkedInLocationIdFilter('  ')).toBe(false);
  });

  it('treats leadership-only as a scope filter', () => {
    expect(hasOrgChartLinkedInLeadershipOnlyFilter(true)).toBe(true);
    expect(hasOrgChartLinkedInLeadershipOnlyFilter(false)).toBe(false);
  });

  it('hasOrgChartLinkedInSubsetScopeFilter is true when linkedinLocationId is set', () => {
    expect(
      hasOrgChartLinkedInSubsetScopeFilter(undefined, undefined, '102713980'),
    ).toBe(true);
  });

  it('hasOrgChartLinkedInSubsetScopeFilter is true when leadershipOnly is set', () => {
    expect(
      hasOrgChartLinkedInSubsetScopeFilter('global', 'fullcompany', undefined, true),
    ).toBe(true);
  });

  it('hasOrgChartLinkedInSubsetScopeFilter stays false without country, function, location id, or leadership', () => {
    expect(
      hasOrgChartLinkedInSubsetScopeFilter('global', 'fullcompany', undefined),
    ).toBe(false);
  });
});
