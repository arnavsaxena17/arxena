import { OrgChartCatalogS3Service } from '../org-chart-catalog-s3.service';

describe('OrgChartCatalogS3Service.buildCatalogKey', () => {
  const service = Object.create(
    OrgChartCatalogS3Service.prototype,
  ) as OrgChartCatalogS3Service;

  it('builds default fullcompany/global keys', () => {
    expect(
      service.buildCatalogKey({ companyId: 'conversantinc' }),
    ).toBe('data/conversantinc_fullcompany_global.json');
  });

  it('normalizes country spaces to hyphens', () => {
    expect(
      service.buildCatalogKey({
        companyId: 'acme',
        type: 'fullcompany',
        country: 'United States',
      }),
    ).toBe('data/acme_fullcompany_united-states.json');
  });
});
