import { timingSafeEqual } from 'crypto';

import { Request } from 'express';

import { ORG_CHART_PDL_PROXY_HEADER } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

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

const secureCompare = (provided: string, expected: string): boolean => {
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
};

export const isOrgChartPdlProxyAuthorized = (
  req: Request,
  environmentService: EnvironmentService,
): boolean => {
  const expectedSecret = environmentService
    .get('ORG_CHART_PDL_PROXY_SECRET')
    ?.trim();
  if (!expectedSecret) {
    return false;
  }

  const providedSecret = getHeaderValue(req, ORG_CHART_PDL_PROXY_HEADER);
  if (!providedSecret) {
    return false;
  }

  return secureCompare(providedSecret, expectedSecret);
};
