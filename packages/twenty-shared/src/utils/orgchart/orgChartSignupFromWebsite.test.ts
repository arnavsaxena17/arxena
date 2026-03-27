import {
    appendOrgChartSignupSearchParams,
    formatOrgChartSliceLabel,
    ORG_CHART_SIGNUP_SEARCH_PARAMS,
} from './orgChartSignupFromWebsite';

describe('orgChartSignupFromWebsite', () => {
  it('appendOrgChartSignupSearchParams adds company and function', () => {
    const out = appendOrgChartSignupSearchParams(
      'https://app.example.com/welcome',
      {
        companyName: 'Acme Inc',
        selectedFunctionRoot: 'engineering',
      },
    );
    const url = new URL(out);
    expect(url.searchParams.get(ORG_CHART_SIGNUP_SEARCH_PARAMS.company)).toBe(
      'Acme Inc',
    );
    expect(url.searchParams.get(ORG_CHART_SIGNUP_SEARCH_PARAMS.function)).toBe(
      'engineering',
    );
  });

  it('skips fullcompany function and omits country when global', () => {
    const out = appendOrgChartSignupSearchParams(
      'https://app.example.com/welcome',
      {
        companyName: 'Acme',
        selectedFunctionRoot: 'fullcompany',
        selectedCountry: 'global',
      },
    );
    const url = new URL(out);
    expect(url.searchParams.has(ORG_CHART_SIGNUP_SEARCH_PARAMS.function)).toBe(
      false,
    );
    expect(url.searchParams.has(ORG_CHART_SIGNUP_SEARCH_PARAMS.country)).toBe(
      false,
    );
  });

  it('formatOrgChartSliceLabel formats slug segments', () => {
    expect(formatOrgChartSliceLabel('engineering_lead')).toBe(
      'Engineering Lead',
    );
  });
});
