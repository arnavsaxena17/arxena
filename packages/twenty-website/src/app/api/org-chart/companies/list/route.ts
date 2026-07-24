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
  const letter = searchParams.get('letter') ?? '';
  const page = searchParams.get('page') ?? '1';
  const maxExposedCount = searchParams.get('maxExposedCount') ?? '';

  const url = new URL(`${serverBaseUrl}/org-chart/companies/list`);
  url.searchParams.set('letter', letter);
  url.searchParams.set('page', page);
  url.searchParams.set('pageSize', '300');
  if (maxExposedCount) url.searchParams.set('maxExposedCount', maxExposedCount);

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { companyIds: [], hasMore: false, status: 'ok' },
      { status: 200 },
    );
  }
}
