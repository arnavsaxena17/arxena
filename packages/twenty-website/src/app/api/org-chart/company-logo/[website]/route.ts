import { NextRequest } from 'next/server';

import { proxyCompanyLogoRequest } from '@/lib/company-logo-proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ website: string }> },
) {
  const { website } = await params;

  return proxyCompanyLogoRequest(
    request,
    decodeURIComponent(website),
    true,
  );
}
