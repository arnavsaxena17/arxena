import { OrgChartProfileDataSourceMapperService } from 'src/engine/core-modules/org-chart/services/org-chart-profile-data-source-mapper.service';

describe('OrgChartProfileDataSourceMapperService', () => {
  const service = new OrgChartProfileDataSourceMapperService();

  it('maps known internal source strings to stable opaque slugs', () => {
    expect(service.toPublicSlugFromRow({ source: 'apollo' })).toBe('m7kq');
    expect(service.toPublicSlugFromRow({ source: 'apollo' })).not.toContain(
      'apollo',
    );
  });

  it('uses chart-level fallback when row has no source', () => {
    expect(
      service.toPublicSlugFromRow({}, 'unipile'),
    ).toBe('h4rj');
  });

  it('returns undefined when there is no source and no fallback', () => {
    expect(service.toPublicSlugFromRow({})).toBeUndefined();
  });
});
