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
  const limit = searchParams.get('limit') ?? '50';
  const batchIndex = searchParams.get('batchIndex') ?? '0';

  try {
    const response = await fetch(
      `${serverBaseUrl}/org-chart/companies/sitemap-urls-by-company?offset=${encodeURIComponent(offset)}&limit=${encodeURIComponent(limit)}&batchIndex=${encodeURIComponent(batchIndex)}`,
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ urls: [], status: 'ok' }, { status: 200 });
  }
}
