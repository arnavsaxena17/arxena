import { NextRequest, NextResponse } from 'next/server';

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
  { params }: { params: Promise<{ shareToken: string }> },
) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const { shareToken } = await params;
  const token = (shareToken ?? '').trim();
  if (!token) {
    return NextResponse.json({ message: 'Share token is required' }, { status: 400 });
  }

  const urlParams = new URL(request.url).searchParams;
  const accessKey = urlParams.get('k')?.trim() ?? '';
  if (!accessKey) {
    return NextResponse.json({ message: 'Access key is required' }, { status: 401 });
  }

  const upstreamUrl = `${serverBaseUrl}/org-chart/share/${encodeURIComponent(token)}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessKey}` },
      cache: 'no-store',
    });
    const text = await response.text();

    // Upstream always returns JSON; if not, surface a stable error.
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

