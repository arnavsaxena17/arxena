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
});
