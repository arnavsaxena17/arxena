import { buildFreeTrialCalendlyUrl } from '../free-trial-calendly';

describe('buildFreeTrialCalendlyUrl', () => {
  it('prefills name, email, company, and org chart context', () => {
    const url = buildFreeTrialCalendlyUrl({
      name: 'Arnav Saxena',
      email: 'arnav@arxena.com',
      company: 'Arxena Inc',
      source: 'org_chart_banner',
      orgChartContext: {
        companyName: 'Google',
        selectedFunctionRoot: 'engineering',
        selectedCountry: 'us',
        nodeHeadline: 'VP Engineering',
      },
    });

    const parsed = new URL(url);

    expect(parsed.searchParams.get('name')).toBe('Arnav Saxena');
    expect(parsed.searchParams.get('email')).toBe('arnav@arxena.com');
    expect(parsed.searchParams.get('a1')).toBe('Arxena Inc');
    expect(parsed.searchParams.get('a2')).toContain('Google');
    expect(parsed.searchParams.get('a2')).toContain('engineering');
    expect(parsed.searchParams.get('utm_medium')).toBe('free_trial');
    expect(parsed.searchParams.get('utm_campaign')).toBe('org_chart_banner');
  });
});
