import { headers } from 'next/headers';

import { getClientIpFromHeaders } from '@/lib/bot-detection';
import { getOrgChartServerBaseUrl } from '@/lib/org-chart-server-base-url';

export const buildForwardedOrgChartHeaders = (
  requestHeaders: Headers,
  forwardedUserAgent?: string,
): Record<string, string> => {
  const forwardedHeaders: Record<string, string> = {};
  const passthroughHeaderNames = [
    'cloudfront-viewer-address',
    'cf-connecting-ip',
    'true-client-ip',
    'x-forwarded-for',
    'x-real-ip',
    'referer',
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
      forwardedHeaders[headerName] = value;
    }
  }

  const clientIp = getClientIpFromHeaders(requestHeaders);
  if (clientIp) {
    forwardedHeaders['x-org-chart-client-ip'] = clientIp;
  }

  if (forwardedUserAgent) {
    forwardedHeaders['x-forwarded-user-agent'] = forwardedUserAgent;
  }

  return forwardedHeaders;
};

export async function fetchPublishedOrgChart(input: {
  publishSlug: string;
  forwardedUserAgent?: string;
}): Promise<Record<string, unknown> | null> {
  const serverBaseUrl = getOrgChartServerBaseUrl();
  const requestHeaders = await headers();
  const forwardedHeaders = buildForwardedOrgChartHeaders(
    requestHeaders,
    input.forwardedUserAgent,
  );

  const url = `${serverBaseUrl}/org-chart/published/${encodeURIComponent(
    input.publishSlug,
  )}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers:
        Object.keys(forwardedHeaders).length > 0 ? forwardedHeaders : undefined,
    });
    const json = (await res.json()) as {
      status?: string;
      result?: Record<string, unknown>;
      message?: string;
    };
    if (json?.status === 'ok' && json.result) {
      return json.result;
    }
    if (process.env.NODE_ENV === 'development') {
      console.warn('[fetchPublishedOrgChart] failed', {
        publishSlug: input.publishSlug,
        status: res.status,
        message: json?.message,
      });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[fetchPublishedOrgChart] error', {
        publishSlug: input.publishSlug,
        error,
      });
    }
  }

  return null;
}
