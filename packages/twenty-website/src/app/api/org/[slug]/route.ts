import { NextRequest, NextResponse } from 'next/server';

import { getOrgChartServerBaseUrl } from '@/lib/org-chart-server-base-url';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const serverBaseUrl = getOrgChartServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const { slug } = await params;
  const publishSlug = (slug ?? '').trim();
  if (!publishSlug) {
    return NextResponse.json({ message: 'Slug is required' }, { status: 400 });
  }

  const upstreamUrl = `${serverBaseUrl}/org-chart/published/${encodeURIComponent(
    publishSlug,
  )}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      cache: 'no-store',
    });
    const text = await response.text();

    if (!text.trim().startsWith('{')) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid response from org chart service' },
        { status: 502 },
      );
    }

    const json = JSON.parse(text) as Record<string, unknown>;
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch org chart' },
      { status: 503 },
    );
  }
}
