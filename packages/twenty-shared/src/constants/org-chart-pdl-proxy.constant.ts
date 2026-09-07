/** Shared secret header: only our website/API proxy should send this to twenty-server. */
export const ORG_CHART_PDL_PROXY_HEADER = 'x-org-chart-pdl-proxy-key';

/**
 * Set by CompanySearchAutocomplete after the user focuses/clicks search.
 * Server requires this (or a homepage Referer) before calling PDL autocomplete.
 */
export const ORG_CHART_COMPANY_SEARCH_HEADER = 'x-arx-company-search';

export const ORG_CHART_COMPANY_SEARCH_HEADER_VALUE = '1';
