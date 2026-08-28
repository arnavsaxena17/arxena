import { NextRequest } from 'next/server';

import { proxyCompanyLogoRequest } from '@/lib/company-logo-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const website =
    request.nextUrl.searchParams.get('website') ??
    new URL(request.url).searchParams.get('website');

  return proxyCompanyLogoRequest(request, website ?? '', false);
}
