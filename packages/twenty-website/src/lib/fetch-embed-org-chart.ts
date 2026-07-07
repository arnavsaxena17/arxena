import { headers } from 'next/headers';

import { buildForwardedOrgChartHeaders } from '@/lib/fetch-published-org-chart';
import { getOrgChartServerBaseUrl } from '@/lib/org-chart-server-base-url';

export async function fetchEmbedOrgChart(input: {
  embedKey: string;
  domain?: string;
  forwardedUserAgent?: string;
}): Promise<{
  companyId: string;
  companyName: string;
  mode: 'live' | 'published';
  options: Record<string, unknown>;
  result: Record<string, unknown>;
} | null> {
  const serverBaseUrl = getOrgChartServerBaseUrl();
  const requestHeaders = await headers();
  const forwardedHeaders = buildForwardedOrgChartHeaders(
    requestHeaders,
    input.forwardedUserAgent,
  );

  const params = new URLSearchParams();
  if (input.domain?.trim()) {
    params.set('domain', input.domain.trim());
  }
  const query = params.toString();
  const url = `${serverBaseUrl}/org-chart/embed/resolve${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        ...forwardedHeaders,
        'X-Embed-Key': input.embedKey,
        ...(requestHeaders.get('referer')
          ? { Referer: requestHeaders.get('referer')! }
          : {}),
        ...(requestHeaders.get('origin')
          ? { Origin: requestHeaders.get('origin')! }
          : {}),
      },
    });
    const json = (await res.json()) as {
      status?: string;
      companyId?: string;
      companyName?: string;
      mode?: 'live' | 'published';
      options?: Record<string, unknown>;
      result?: Record<string, unknown>;
      message?: string;
    };

    if (
      json?.status === 'ok' &&
      json.result &&
      json.companyId &&
      json.companyName
    ) {
      return {
        companyId: json.companyId,
        companyName: json.companyName,
        mode: json.mode ?? 'live',
        options: json.options ?? {},
        result: json.result,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[fetchEmbedOrgChart] error', error);
    }
  }

  return null;
}
