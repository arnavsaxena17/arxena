import {
    hasMeaningfulLinkedInLocationIdFilter,
    hasOrgChartLinkedInSubsetScopeFilter,
} from 'src/engine/core-modules/org-chart/utils/orgchart-linkedin-scope.util';

describe('orgchart-linkedin-scope.util', () => {
  it('treats linkedin location id as a scope filter', () => {
    expect(hasMeaningfulLinkedInLocationIdFilter('102713980')).toBe(true);
    expect(hasMeaningfulLinkedInLocationIdFilter('  ')).toBe(false);
  });

  it('hasOrgChartLinkedInSubsetScopeFilter is true when linkedinLocationId is set', () => {
    expect(
      hasOrgChartLinkedInSubsetScopeFilter(undefined, undefined, '102713980'),
    ).toBe(true);
  });

  it('hasOrgChartLinkedInSubsetScopeFilter stays false without country, function, or location id', () => {
    expect(
      hasOrgChartLinkedInSubsetScopeFilter('global', 'fullcompany', undefined),
    ).toBe(false);
  });
});
