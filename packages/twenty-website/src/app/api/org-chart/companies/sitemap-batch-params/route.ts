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
  const batchIndex = searchParams.get('batchIndex') ?? '0';

  try {
    const response = await fetch(
      `${serverBaseUrl}/org-chart/companies/sitemap-batch-params?batchIndex=${encodeURIComponent(batchIndex)}`,
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      {
        country: 'global',
        type: 'fullcompany',
        offset: 0,
        limit: 500,
        status: 'ok',
      },
      { status: 200 },
    );
  }
}
