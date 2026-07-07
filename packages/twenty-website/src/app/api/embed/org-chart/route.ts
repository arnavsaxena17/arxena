import { NextRequest, NextResponse } from 'next/server';

import { getOrgChartServerBaseUrl } from '@/lib/org-chart-server-base-url';

export const dynamic = 'force-dynamic';

const getEmbedKey = (request: NextRequest): string =>
  request.headers.get('x-embed-key') ??
  request.nextUrl.searchParams.get('embedKey') ??
  request.nextUrl.searchParams.get('key') ??
  '';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const embedKey = getEmbedKey(request);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, X-Embed-Key, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (!origin || !embedKey.trim()) {
    return new NextResponse(null, { status: 204, headers });
  }

  const serverBaseUrl = getOrgChartServerBaseUrl();
  try {
    const checkUrl = `${serverBaseUrl}/org-chart/embed/resolve?domain=ping`;
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'X-Embed-Key': embedKey.trim(),
        Origin: origin,
        Referer: origin,
      },
    });

    if (response.status !== 403 && response.status !== 404) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  } catch {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  const serverBaseUrl = getOrgChartServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const embedKey = getEmbedKey(request);

  if (!embedKey.trim()) {
    return NextResponse.json(
      { status: 'error', message: 'X-Embed-Key header is required' },
      { status: 400 },
    );
  }

  const upstreamParams = new URLSearchParams(request.nextUrl.searchParams);
  upstreamParams.delete('embedKey');
  upstreamParams.delete('key');
  const query = upstreamParams.toString();
  const upstreamUrl = `${serverBaseUrl}/org-chart/embed/resolve${query ? `?${query}` : ''}`;

  const passthroughHeaders: Record<string, string> = {
    'X-Embed-Key': embedKey.trim(),
  };

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (origin) {
    passthroughHeaders.Origin = origin;
  }
  if (referer) {
    passthroughHeaders.Referer = referer;
  }

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: passthroughHeaders,
    });
    const text = await response.text();

    if (!text.trim().startsWith('{')) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid response from embed service' },
        { status: 502 },
      );
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Vary: 'Origin',
    };

    if (origin && response.ok) {
      responseHeaders['Access-Control-Allow-Origin'] = origin;
    }

    return NextResponse.json(json, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch embed org chart' },
      { status: 503 },
    );
  }
}
