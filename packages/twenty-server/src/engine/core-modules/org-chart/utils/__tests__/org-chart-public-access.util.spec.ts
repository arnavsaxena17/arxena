import { Request } from 'express';

import {
  getOrgChartGuardMode,
  isVerifiedBotFromRequest,
  shouldDenyUnauthenticatedOrgChartAccess,
} from '../org-chart-public-access.util';

const buildRequest = (headers: Record<string, string>): Request =>
  ({ headers }) as Request;

describe('org-chart-public-access.util', () => {
  beforeEach(() => {
    delete process.env.ORG_CHART_GUARD_MODE;
  });

  it('getOrgChartGuardMode defaults to log_only', () => {
    expect(getOrgChartGuardMode()).toBe('log_only');
  });

  it('isVerifiedBotFromRequest reads verified bot header', () => {
    const req = buildRequest({ 'x-org-chart-verified-bot': '1' });
    expect(isVerifiedBotFromRequest(req)).toBe(true);
  });

  it('shouldDenyUnauthenticatedOrgChartAccess is false with auth token', () => {
    const req = buildRequest({});
    expect(shouldDenyUnauthenticatedOrgChartAccess(req, true)).toBe(false);
  });

  it('shouldDenyUnauthenticatedOrgChartAccess enforces for scraper-like clients', () => {
    process.env.ORG_CHART_GUARD_MODE = 'enforce';
    const req = buildRequest({
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    });
    expect(shouldDenyUnauthenticatedOrgChartAccess(req, false)).toBe(true);
  });
});
