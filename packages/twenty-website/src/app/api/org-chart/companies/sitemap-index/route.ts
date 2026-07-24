import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

export async function GET() {
  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `${serverBaseUrl}/org-chart/companies/sitemap-index`,
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ companyIds: [], status: 'ok' }, { status: 200 });
  }
}
