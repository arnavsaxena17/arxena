/** Query params appended when linking from the marketing org chart to app sign-up (/welcome). */
export const ORG_CHART_SIGNUP_SEARCH_PARAMS = {
  company: 'orgChartCompany',
  function: 'orgChartFunction',
  country: 'orgChartCountry',
} as const;

export const formatOrgChartSliceLabel = (s: string): string =>
  s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export type OrgChartSignupUrlParams = {
  companyName?: string;
  selectedCountry?: string;
  selectedFunctionRoot?: string;
};

export const appendOrgChartSignupSearchParams = (
  baseUrl: string,
  params: OrgChartSignupUrlParams,
): string => {
  const baseForRelative =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://app.arxena.com';

  let url: URL;
  try {
    url = baseUrl.startsWith('http')
      ? new URL(baseUrl)
      : new URL(baseUrl, baseForRelative);
  } catch {
    return baseUrl;
  }

  const companyTrimmed = params.companyName?.trim();
  if (companyTrimmed) {
    url.searchParams.set(ORG_CHART_SIGNUP_SEARCH_PARAMS.company, companyTrimmed);
  }
  if (
    params.selectedFunctionRoot &&
    params.selectedFunctionRoot !== 'fullcompany'
  ) {
    url.searchParams.set(
      ORG_CHART_SIGNUP_SEARCH_PARAMS.function,
      params.selectedFunctionRoot,
    );
  }
  if (params.selectedCountry && params.selectedCountry !== 'global') {
    url.searchParams.set(
      ORG_CHART_SIGNUP_SEARCH_PARAMS.country,
      params.selectedCountry,
    );
  }

  return url.toString();
};
