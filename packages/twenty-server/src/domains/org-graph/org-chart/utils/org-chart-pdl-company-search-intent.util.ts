import { Request } from 'express';

import {
  ORG_CHART_COMPANY_SEARCH_HEADER,
  ORG_CHART_COMPANY_SEARCH_HEADER_VALUE,
} from 'twenty-shared';

const getHeaderValue = (req: Request, name: string): string | null => {
  const raw = req.headers[name];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    const first = raw[0].trim();
    return first.length > 0 ? first : null;
  }
  return null;
};

/**
 * PDL company autocomplete only when the company-search UI sends its intent
 * header (user clicked/focused search and typed). Homepage Referer alone is not
 * enough — org-chart page loads and hired-from navigation must never unlock PDL.
 */
export const isOrgChartPdlCompanySearchIntentAllowed = (
  req: Request,
): boolean => {
  const searchHeader = getHeaderValue(req, ORG_CHART_COMPANY_SEARCH_HEADER);
  return searchHeader === ORG_CHART_COMPANY_SEARCH_HEADER_VALUE;
};
