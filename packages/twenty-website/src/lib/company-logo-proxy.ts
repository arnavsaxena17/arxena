import { NextRequest, NextResponse } from 'next/server';

import { isLikelyBrowserLogoRequest } from 'twenty-shared/utils';

import { buildOrgChartUpstreamHeaders } from '@/lib/org-chart-proxy-headers';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://app.arxena.com');
  return url.replace(/\/$/, '');
};

export const proxyCompanyLogoRequest = async (
  request: NextRequest,
  website: string,
  allowPublicCaching: boolean,
) => {
  if (!isLikelyBrowserLogoRequest(request.headers)) {
    return new NextResponse(null, { status: 404 });
  }

  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return new NextResponse(null, { status: 500 });
  }

  if (!website?.trim()) {
    return NextResponse.json(
      { message: 'Website is required' },
      { status: 400 },
    );
  }

  try {
    const upstreamHeaders = buildOrgChartUpstreamHeaders(request.headers, {
      allowPdlProxy: false,
    });
    upstreamHeaders['X-Org-Chart-Likely-Browser'] = '1';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const upstreamPath = allowPublicCaching
      ? `${serverBaseUrl}/org-chart/company-logo/${encodeURIComponent(website)}`
      : `${serverBaseUrl}/org-chart/company-logo?website=${encodeURIComponent(website)}`;

    const response = await fetch(upstreamPath, {
      method: 'GET',
      signal: controller.signal,
      headers: upstreamHeaders,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': allowPublicCaching
          ? 'public, max-age=86400, stale-while-revalidate=604800'
          : 'private, no-cache',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 504 });
    }
    return new NextResponse(null, { status: 404 });
  }
};
