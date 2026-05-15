import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
    applyOrgChartLikelyBrowserRequestHeader,
    checkOrgChartApiGuard,
    orgChartApiGuardToResponse,
    resolveOrgChartRateLimitProfile,
} from '@/lib/org-chart-api-guard';

/**
 * Next.js treats POST + application/x-www-form-urlencoded as a potential Server Action
 * (see getIsServerAction in next/dist/server/lib/server-action-request-meta.js).
 * Scanners and bots often POST urlencoded bodies without `Next-Action`, which triggers
 * "Failed to find Server Action" / "Missing 'next-action' header" and noisy error logs.
 * Real Server Action requests from Next include the Next-Action header.
 */
function isMalformedServerActionStylePost(request: NextRequest): boolean {
  if (request.method !== 'POST') {
    return false;
  }
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return false;
  }
  const contentType = request.headers.get('content-type') ?? '';
  const baseType = contentType.split(';')[0]?.trim() ?? '';
  if (baseType !== 'application/x-www-form-urlencoded') {
    return false;
  }
  if (request.headers.get('next-action')) {
    return false;
  }
  return true;
}

export function middleware(request: NextRequest) {
  if (isMalformedServerActionStylePost(request)) {
    return new NextResponse(null, { status: 400 });
  }

  const pathname = request.nextUrl.pathname;
  const orgChartProfile = resolveOrgChartRateLimitProfile(pathname);
  if (orgChartProfile) {
    const guardResult = checkOrgChartApiGuard(request.headers, pathname);
    if (!guardResult.allowed) {
      return orgChartApiGuardToResponse(guardResult, orgChartProfile);
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (orgChartProfile) {
    applyOrgChartLikelyBrowserRequestHeader(requestHeaders);
  }

  // Bots and proxied requests often omit Origin. Next.js Server Actions validation
  // then fails with "Missing origin header" and can trigger "s is not a function".
  // Set Origin from Host when missing so validation sees a same-origin value.
  if (!requestHeaders.get('origin')) {
    const proto =
      requestHeaders.get('x-forwarded-proto') ||
      (request.url.startsWith('https') ? 'https' : 'http');
    const host =
      requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || 'arxena.com';
    requestHeaders.set('origin', `${proto}://${host}`);
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // CORS for API routes only (existing behavior)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    res.headers.append('Access-Control-Allow-Origin', '*');
    res.headers.append('Access-Control-Allow-Credentials', 'true');
    res.headers.append(
      'Access-Control-Allow-Methods',
      'GET,DELETE,PATCH,POST,PUT',
    );
    res.headers.append(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-origin-domain, x-domain-origin, X-Origin-Domain, X-Domain-Origin',
    );
  }

  return res;
}

export const config = {
  // Run for all routes except static assets so missing Origin is fixed for crawlers (e.g. /org-chart/pandadoc)
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
