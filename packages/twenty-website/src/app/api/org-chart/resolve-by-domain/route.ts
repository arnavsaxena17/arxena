import { NextRequest, NextResponse } from 'next/server';

import { resolveIsLikelyBrowser } from '@/lib/org-chart-api-guard';
import { buildOrgChartUpstreamHeaders } from '@/lib/org-chart-proxy-headers';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

const BACKEND_PATH = '/org-chart/companies/resolve-by-domain';

export async function GET(request: NextRequest) {
  const allowPdlProxy = resolveIsLikelyBrowser(request.headers);
  if (!allowPdlProxy) {
    return NextResponse.json({ found: false, status: 'ok' }, { status: 200 });
  }

  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const domain =
    request.nextUrl.searchParams.get('domain') ??
    request.nextUrl.searchParams.get('website');
  if (!domain?.trim()) {
    return NextResponse.json(
      { message: 'Query param "domain" is required' },
      { status: 400 },
    );
  }

  const upstreamHeaders = buildOrgChartUpstreamHeaders(request.headers, {
    allowPdlProxy,
  });
  const query = new URLSearchParams({ domain: domain.trim() });

  try {
    const response = await fetch(
      `${serverBaseUrl}${BACKEND_PATH}?${query.toString()}`,
      {
        method: 'GET',
        headers: upstreamHeaders,
        cache: 'no-store',
      },
    );

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('application/json')) {
      return NextResponse.json({ found: false, status: 'ok' }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ found: false, status: 'ok' }, { status: 200 });
  }
}
