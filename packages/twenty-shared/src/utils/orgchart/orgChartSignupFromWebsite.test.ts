import {
    appendOrgChartSignupSearchParams,
    consumeOrgChartSignupContext,
    formatOrgChartSliceLabel,
    navigateToOrgChartSignup,
    ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME,
    ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY,
    ORG_CHART_SIGNUP_SEARCH_PARAMS,
    persistOrgChartSignupContext,
    stripOrgChartSignupSearchParams
} from './orgChartSignupFromWebsite';

describe('orgChartSignupFromWebsite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = `${ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME}=; path=/; max-age=0`;
  });

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

  it('stripOrgChartSignupSearchParams removes org chart query keys', () => {
    const out = stripOrgChartSignupSearchParams(
      'https://app.example.com/welcome?orgChartCompany=Acme&orgChartFunction=eng&foo=bar',
    );
    const url = new URL(out);
    expect(url.pathname).toBe('/welcome');
    expect(url.searchParams.get('foo')).toBe('bar');
    expect(url.searchParams.has(ORG_CHART_SIGNUP_SEARCH_PARAMS.company)).toBe(
      false,
    );
  });

  it('persistOrgChartSignupContext stores cookie and sessionStorage', () => {
    persistOrgChartSignupContext({
      companyName: ' Acme ',
      selectedCountry: 'global',
      selectedFunctionRoot: 'fullcompany',
    });

    expect(sessionStorage.getItem(ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY)).toBe(
      JSON.stringify({ companyName: 'Acme' }),
    );
    expect(document.cookie).toContain(
      `${ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME}=`,
    );
  });

  it('consumeOrgChartSignupContext reads once and clears', () => {
    persistOrgChartSignupContext({
      companyName: 'Acme',
      selectedFunctionRoot: 'engineering',
    });

    expect(consumeOrgChartSignupContext()).toEqual({
      companyName: 'Acme',
      selectedFunctionRoot: 'engineering',
    });
    expect(sessionStorage.getItem(ORG_CHART_SIGNUP_CONTEXT_STORAGE_KEY)).toBe(
      null,
    );
    expect(document.cookie.includes(ORG_CHART_SIGNUP_CONTEXT_COOKIE_NAME)).toBe(
      false,
    );
  });

  it('navigateToOrgChartSignup assigns plain welcome URL', () => {
    const assign = jest.fn();
    Object.defineProperty(window, 'location', {
      value: {
        assign,
        protocol: 'https:',
        hostname: 'arxena.com',
      },
      writable: true,
    });

    navigateToOrgChartSignup('https://app.example.com/welcome', {
      companyName: 'Acme Inc',
      selectedFunctionRoot: 'engineering',
    });

    expect(assign).toHaveBeenCalledWith('https://app.example.com/welcome');
    expect(consumeOrgChartSignupContext()).toEqual({
      companyName: 'Acme Inc',
      selectedFunctionRoot: 'engineering',
    });
  });

  it('formatOrgChartSliceLabel formats slug segments', () => {
    expect(formatOrgChartSliceLabel('engineering_lead')).toBe(
      'Engineering Lead',
    );
  });
});
