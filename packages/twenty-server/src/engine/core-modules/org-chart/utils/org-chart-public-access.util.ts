import { Request } from 'express';

import {
    isLikelyBrowserRequest,
    ORG_CHART_VERIFIED_BOT_HEADER,
} from 'twenty-shared';

export type OrgChartGuardMode = 'log_only' | 'enforce';

export const getOrgChartGuardMode = (): OrgChartGuardMode => {
  const raw = process.env.ORG_CHART_GUARD_MODE?.trim().toLowerCase();
  if (raw === 'enforce') {
    return 'enforce';
  }
  return 'log_only';
};

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

export const isVerifiedBotFromRequest = (req: Request): boolean => {
  const fromWebsite = getHeaderValue(req, ORG_CHART_VERIFIED_BOT_HEADER);
  if (fromWebsite === '1') {
    return true;
  }
  return getHeaderValue(req, 'x-org-chart-verified-bot') === '1';
};

export const isLikelyBrowserOrgChartRequest = (req: Request): boolean => {
  const fromWebsite = getHeaderValue(req, 'x-org-chart-likely-browser');
  if (fromWebsite === '1') {
    return true;
  }
  return isLikelyBrowserRequest(req.headers);
};

export const shouldDenyUnauthenticatedOrgChartAccess = (
  req: Request,
  hasAuthToken: boolean,
): boolean => {
  if (hasAuthToken) {
    return false;
  }
  if (isLikelyBrowserOrgChartRequest(req) || isVerifiedBotFromRequest(req)) {
    return false;
  }
  return getOrgChartGuardMode() === 'enforce';
};
