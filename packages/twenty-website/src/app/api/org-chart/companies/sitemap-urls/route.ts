import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

export async function GET(request: NextRequest) {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const offset = searchParams.get('offset') ?? '0';
  const limit = searchParams.get('limit') ?? '500';
  const country = searchParams.get('country') ?? '';
  const type = searchParams.get('type') ?? '';

  const url = new URL(`${serverBaseUrl}/org-chart/companies/sitemap-urls`);
  url.searchParams.set('offset', offset);
  url.searchParams.set('limit', limit);
  if (country) url.searchParams.set('country', country);
  if (type) url.searchParams.set('type', type);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ urls: [], status: 'ok' }, { status: 200 });
  }
}
