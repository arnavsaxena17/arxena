import { OrgChartSuperImposeService } from 'src/engine/core-modules/org-chart/services/org-chart-super-impose.service';

describe('OrgChartSuperImposeService.resolveInputs', () => {
  const ctx = {} as OrgChartSuperImposeService;

  it('prefers targetCompany over background primary chart', async () => {
    const result = await OrgChartSuperImposeService.prototype.resolveInputs.call(
      ctx,
      {
        inputs: {
          targetCompany: {
            id: '12345',
            title: 'Target Company',
            slug: 'target-company',
            linkedinCompanyUrl: 'https://www.linkedin.com/company/target-company/',
          },
        },
        primaryLinkedinCompanyUrl:
          'https://www.linkedin.com/company/background-co/',
        primaryCompanyName: 'Background Co',
        primaryCompanyId: 'background-co',
      },
    );

    expect(result.resolvedCompanies).toHaveLength(1);
    expect(result.resolvedCompanies[0]).toMatchObject({
      slug: 'target-company',
      resolvedFrom: 'primary_chart',
      companyName: 'Target Company',
    });
  });

  it('falls back to background primary when targetCompany is absent', async () => {
    const result = await OrgChartSuperImposeService.prototype.resolveInputs.call(
      ctx,
      {
        inputs: {},
        primaryLinkedinCompanyUrl:
          'https://www.linkedin.com/company/background-co/',
        primaryCompanyName: 'Background Co',
        primaryCompanyId: 'background-co',
      },
    );

    expect(result.resolvedCompanies).toHaveLength(1);
    expect(result.resolvedCompanies[0]?.slug).toBe('background-co');
  });

  it('expands StayVista alias group across LinkedIn slugs', async () => {
    const result = await OrgChartSuperImposeService.prototype.resolveInputs.call(
      ctx,
      {
        inputs: {
          linkedinCompanyUrls: [
            'https://www.linkedin.com/company/vista-rooms/',
          ],
        },
      },
    );

    const slugs = result.resolvedCompanies.map((company) => company.slug);
    expect(slugs[0]).toBe('vista-rooms');
    expect(slugs).toEqual(
      expect.arrayContaining(['vista-rooms', 'stay-vista', 'stayvista']),
    );
  });

  it('expands Meta alias group to facebook LinkedIn slug', async () => {
    const result = await OrgChartSuperImposeService.prototype.resolveInputs.call(
      ctx,
      {
        inputs: {
          linkedinCompanyUrls: ['https://www.linkedin.com/company/meta/'],
        },
      },
    );

    const slugs = result.resolvedCompanies.map((company) => company.slug);
    expect(slugs).toEqual(expect.arrayContaining(['meta', 'facebook']));
  });
});
