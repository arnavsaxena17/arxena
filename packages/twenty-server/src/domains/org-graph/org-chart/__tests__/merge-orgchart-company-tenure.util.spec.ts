import { mergeOrgChartCompanyTenureOntoOrgChartData } from '../utils/merge-orgchart-company-tenure.util';

describe('mergeOrgChartCompanyTenureOntoOrgChartData', () => {
  it('writes org_chart_company_tenure_* and candidates.org_chart_company_tenure', () => {
    const orgData = {
      orgchart: [
        {
          key: 1,
          headline: 'Engineering',
          linkedin_url_0: 'https://www.linkedin.com/in/a',
          name_0: 'Alice',
          title_0: 'Engineer',
          candidates: [
            {
              full_name: 'Alice',
              job_title: 'Engineer',
              std_linkedin_url: 'https://www.linkedin.com/in/a',
              id: 'p1',
            },
          ],
        },
      ],
    };

    const tenureByUrl = new Map<string, 'current' | 'past'>([
      ['https://www.linkedin.com/in/a', 'current'],
    ]);

    const out = mergeOrgChartCompanyTenureOntoOrgChartData(
      orgData,
      tenureByUrl,
      new Map(),
    );

    const nodes = out.orgchart as Record<string, unknown>[];
    expect(nodes[0].org_chart_company_tenure_0).toBe('current');
    const c0 = (nodes[0].candidates as Record<string, unknown>[])[0];
    expect(c0.org_chart_company_tenure).toBe('current');
  });
});
