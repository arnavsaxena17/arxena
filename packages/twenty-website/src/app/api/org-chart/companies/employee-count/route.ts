import { NextRequest, NextResponse } from 'next/server';

import {
    buildOrgChartUpstreamHeaders,
    rejectBlockedOrgChartBot,
} from '@/lib/org-chart-proxy-headers';

export const dynamic = 'force-dynamic';

const getServerBaseUrl = () => {
  const url =
    process.env.SERVER_BASE_URL ??
    process.env.NEXT_PUBLIC_SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  return url.replace(/\/$/, '');
};

const BACKEND_PATH = '/org-chart/companies/employee-count';

export async function GET(request: NextRequest) {
  const blocked = rejectBlockedOrgChartBot(request);
  if (blocked) {
    return blocked;
  }

  const serverBaseUrl = getServerBaseUrl();
  if (!serverBaseUrl) {
    return NextResponse.json(
      { message: 'Server base URL not configured' },
      { status: 500 },
    );
  }

  const companyId = request.nextUrl.searchParams.get('companyId');
  const linkedinUrl = request.nextUrl.searchParams.get('linkedinUrl');

  if (!companyId?.trim() && !linkedinUrl?.trim()) {
    return NextResponse.json(
      { message: 'Query param "companyId" or "linkedinUrl" is required' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams();
  if (companyId?.trim()) params.set('companyId', companyId.trim());
  if (linkedinUrl?.trim()) params.set('linkedinUrl', linkedinUrl.trim());

  try {
    const response = await fetch(
      `${serverBaseUrl}${BACKEND_PATH}?${params.toString()}`,
      {
        headers: buildOrgChartUpstreamHeaders(request.headers),
      },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { employeeCount: null, status: 'ok' },
      { status: 200 },
    );
  }
}
