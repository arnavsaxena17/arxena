import {
    buildCanonicalOrgChartPath,
    buildOrgChartS3LookupPlan,
    collectOrgChartCompanyIdsForLookup,
    resolveOrgChartCanonicalCompanyId,
    resolveOrgChartCompanyAliasGroup,
    shouldRedirectOrgChartCompanySlug,
} from './orgChartCompanyAliases';

describe('orgChartCompanyAliases', () => {
  it('resolves stay-vista to vista-rooms group', () => {
    const group = resolveOrgChartCompanyAliasGroup('stay-vista');
    expect(group?.canonicalId).toBe('vista-rooms');
    expect(group?.preferredS3Variant).toBe('apify_org_intelligence');
  });

  it('resolves vista_rooms underscore form', () => {
    expect(resolveOrgChartCanonicalCompanyId('vista_rooms')).toBe('vista-rooms');
  });

  it('collects canonical and aliases for lookup', () => {
    const ids = collectOrgChartCompanyIdsForLookup('stay-vista');
    expect(ids[0]).toBe('vista-rooms');
    expect(ids).toContain('stay-vista');
  });

  it('builds S3 lookup plan with preferred variant first', () => {
    const plan = buildOrgChartS3LookupPlan('stay-vista');
    expect(plan[0]).toEqual({
      companyId: 'vista-rooms',
      s3Variant: 'apify_org_intelligence',
    });
    expect(plan[1]).toEqual({ companyId: 'vista-rooms' });
  });

  it('returns single id for unknown companies', () => {
    expect(collectOrgChartCompanyIdsForLookup('acme-corp')).toEqual(['acme-corp']);
    expect(buildOrgChartS3LookupPlan('acme-corp')).toEqual([
      { companyId: 'acme-corp' },
    ]);
  });

  it('redirects meta to facebook canonical path', () => {
    expect(shouldRedirectOrgChartCompanySlug('meta')).toBe(true);
    expect(buildCanonicalOrgChartPath({ companyId: 'meta' })).toBe(
      '/org-chart/facebook',
    );
  });

  it('redirects tesla to tesla-motors', () => {
    expect(buildCanonicalOrgChartPath({ companyId: 'tesla' })).toBe(
      '/org-chart/tesla-motors',
    );
  });

  it('preserves tail segments in canonical path', () => {
    expect(
      buildCanonicalOrgChartPath({
        companyId: 'meta',
        tailSegments: ['united-states', 'engineering'],
      }),
    ).toBe('/org-chart/facebook/united-states/engineering');
  });
});
