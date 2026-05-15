import { NextRequest, NextResponse } from 'next/server';

import { getRequestMetadata, isBlockedBot } from '@/lib/bot-detection';
import { buildOrgChartUpstreamHeaders } from '@/lib/org-chart-proxy-headers';
import { decodeOverEncodedPath } from '@/lib/url-utils';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://app.arxena.com');
  return url.replace(/\/$/, '');
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const forwardedUserAgent = request.headers.get('x-forwarded-user-agent');
  const { userAgent, referer, clientIp } = getRequestMetadata(request);
  const effectiveUserAgent = forwardedUserAgent ?? userAgent;
  if (isBlockedBot(effectiveUserAgent)) {
    return NextResponse.json(
      { status: 'error', message: 'Forbidden' },
      { status: 403 },
    );
  }

  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const { segments } = await params;
  if (!segments || segments.length === 0) {
    return NextResponse.json(
      { message: 'Company ID is required' },
      { status: 400 },
    );
  }

  const rawPathPart = segments.join('/');
  const pathPart = decodeOverEncodedPath(rawPathPart);
  const nextParams = request.nextUrl.searchParams;
  const urlParams = new URL(request.url).searchParams;
  const isImageProxy = pathPart === 'image-proxy';

  const queryParams = new URLSearchParams();
  if (isImageProxy) {
    urlParams.forEach((value, key) => queryParams.set(key, value));
  } else {
    const companyName =
      nextParams.get('companyName') ?? urlParams.get('companyName');
    const website = nextParams.get('website') ?? urlParams.get('website');
    const country = nextParams.get('country') ?? urlParams.get('country');
    const functionRoot =
      nextParams.get('functionRoot') ?? urlParams.get('functionRoot');
    if (companyName) queryParams.set('companyName', companyName);
    if (website) queryParams.set('website', website);
    if (country) queryParams.set('country', country);
    if (functionRoot) queryParams.set('functionRoot', functionRoot);
  }

  const queryString = queryParams.toString();
  const url = `${serverBaseUrl}/org-chart/${pathPart}${queryString ? `?${queryString}` : ''}`;

  try {
    const authHeader = request.headers.get('authorization');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...buildOrgChartUpstreamHeaders(request.headers, {
          forwardedUserAgent: effectiveUserAgent,
        }),
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const contentType = response.headers.get('content-type') ?? '';

    if (isImageProxy && contentType.startsWith('image/')) {
      const blob = await response.arrayBuffer();
      return new NextResponse(blob, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      });
    }

    const text = await response.text();

    if (
      !contentType.includes('application/json') ||
      !text.trim().startsWith('{')
    ) {
      console.error('Org chart proxy: upstream returned non-JSON', {
        url,
        status: response.status,
        contentType,
        bodyPreview: text.slice(0, 100),
        userAgent: effectiveUserAgent ?? '(none)',
        referer: referer ?? '(none)',
        clientIp: clientIp ?? '(none)',
      });
      return NextResponse.json(
        {
          status: 'error',
          message: response.ok
            ? 'Invalid response from org chart service'
            : `Org chart service error (${response.status})`,
        },
        {
          status: response.ok
            ? 502
            : response.status >= 500
              ? 502
              : response.status,
        },
      );
    }

    const data = JSON.parse(text) as Record<string, unknown>;
    const isLikelyBot =
      effectiveUserAgent &&
      /bot|crawler|spider|scraper|bytespider|petalbot/i.test(
        effectiveUserAgent,
      );
    const shouldLog =
      process.env.LOG_ORG_CHART_REQUESTS === '1' || isLikelyBot;
    if (effectiveUserAgent && shouldLog) {
      console.log('[OrgChart proxy]', {
        path: pathPart,
        userAgent: effectiveUserAgent,
        referer: referer ?? undefined,
        clientIp: clientIp ?? undefined,
      });
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch org chart' },
      { status: 503 },
    );
  }
}
