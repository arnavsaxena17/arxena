import { ORG_CHART_PDL_PROXY_HEADER } from 'twenty-shared';

import {
    getClientIpFromHeaders,
    isBlockedBot,
} from '@/lib/bot-detection';
import { resolveIsLikelyBrowser } from '@/lib/org-chart-api-guard';

export const buildOrgChartUpstreamHeaders = (
  requestHeaders: Headers,
  options?: {
    forwardedUserAgent?: string | null;
    /** When false, PDL proxy key is omitted so the server will not call PDL. */
    allowPdlProxy?: boolean;
  },
): Record<string, string> => {
  const headers: Record<string, string> = {};
  const passthroughHeaderNames = [
    'cloudfront-viewer-address',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-for',
    'x-real-ip',
    'referer',
    'authorization',
    'cookie',
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ] as const;

  for (const headerName of passthroughHeaderNames) {
    const value = requestHeaders.get(headerName);
    if (value) {
      headers[headerName] = value;
    }
  }

  const clientIp = getClientIpFromHeaders(requestHeaders);
  if (clientIp) {
    headers['X-Org-Chart-Client-Ip'] = clientIp;
  }

  const effectiveUserAgent =
    options?.forwardedUserAgent ?? requestHeaders.get('user-agent');
  if (effectiveUserAgent) {
    headers['X-Org-Chart-Client-User-Agent'] = effectiveUserAgent;
  }

  const allowPdlProxy =
    options?.allowPdlProxy ?? resolveIsLikelyBrowser(requestHeaders);
  const pdlProxySecret = process.env.ORG_CHART_PDL_PROXY_SECRET?.trim();
  if (allowPdlProxy && pdlProxySecret) {
    headers[ORG_CHART_PDL_PROXY_HEADER] = pdlProxySecret;
  }

  return headers;
};

export const rejectBlockedOrgChartBot = (
  request: Request,
): Response | null => {
  const forwardedUserAgent = request.headers.get('x-forwarded-user-agent');
  const userAgent = forwardedUserAgent ?? request.headers.get('user-agent');
  if (isBlockedBot(userAgent)) {
    return Response.json(
      { status: 'error', message: 'Forbidden' },
      { status: 403 },
    );
  }
  return null;
};
