import { applyOrgChartCompanyMetadata } from 'src/engine/core-modules/org-chart/utils/apply-org-chart-company-metadata.util';

describe('applyOrgChartCompanyMetadata', () => {
  it('sets top-level website and linkedin URL from build request metadata', () => {
    const orgChart = {
      type: 'fullcompany',
      job_company_website: '',
      job_company_linkedin_url: '',
    };

    const result = applyOrgChartCompanyMetadata(orgChart, {
      website: 'https://dista.ai',
      linkedinCompanyUrl:
        'https://www.linkedin.com/company/dista-location-intelligence/',
    });

    expect(result.job_company_website).toBe('https://dista.ai');
    expect(result.job_company_linkedin_url).toBe(
      'https://www.linkedin.com/company/dista-location-intelligence',
    );
  });

  it('returns the same object when no metadata is provided', () => {
    const orgChart = {
      type: 'fullcompany',
      job_company_website: 'https://example.com',
    };

    const result = applyOrgChartCompanyMetadata(orgChart, {});

    expect(result).toBe(orgChart);
  });
});
