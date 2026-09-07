import { Request } from 'express';

import { ORG_CHART_COMPANY_SEARCH_HEADER } from 'twenty-shared';

import { isOrgChartPdlCompanySearchIntentAllowed } from 'src/engine/core-modules/org-chart/utils/org-chart-pdl-company-search-intent.util';

const buildRequest = (headers: Record<string, string>): Request =>
  ({ headers }) as Request;

describe('isOrgChartPdlCompanySearchIntentAllowed', () => {
  it('allows when company-search header is set', () => {
    expect(
      isOrgChartPdlCompanySearchIntentAllowed(
        buildRequest({ [ORG_CHART_COMPANY_SEARCH_HEADER]: '1' }),
      ),
    ).toBe(true);
  });

  it('rejects homepage referer without search header', () => {
    expect(
      isOrgChartPdlCompanySearchIntentAllowed(
        buildRequest({ referer: 'https://arxena.com/' }),
      ),
    ).toBe(false);
  });

  it('rejects org-chart page referer without search header', () => {
    expect(
      isOrgChartPdlCompanySearchIntentAllowed(
        buildRequest({ referer: 'https://arxena.com/org-chart/netflix' }),
      ),
    ).toBe(false);
  });

  it('rejects missing header', () => {
    expect(isOrgChartPdlCompanySearchIntentAllowed(buildRequest({}))).toBe(
      false,
    );
  });
});
