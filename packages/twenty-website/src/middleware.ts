import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { isVerifiedSearchBot } from 'twenty-shared';

import { getClientIpFromHeaders } from '@/lib/bot-detection';
import {
  applyOrgChartLikelyBrowserRequestHeader,
  applyOrgChartVerifiedBotRequestHeader,
  checkOrgChartApiGuard,
  orgChartApiGuardToResponse,
  resolveIsLikelyBrowser,
  resolveOrgChartRateLimitProfile,
} from '@/lib/org-chart-api-guard';
import {
  getArxStaticCookieOptions,
  hasArxStaticAssetCookie,
  isOrgChartStaticAssetRequest,
  ORG_CHART_STATIC_ONLY_HEADER,
  resolveOrgChartStaticOnly,
} from '@/lib/org-chart-static-only';

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

function handleNextStaticAssetGate(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith('/_next/static')) {
    return null;
  }

  if (hasArxStaticAssetCookie(request.cookies)) {
    return NextResponse.next();
  }

  const referer = request.headers.get('referer');
  if (!isOrgChartStaticAssetRequest(referer)) {
    return NextResponse.next();
  }

  return new NextResponse(null, { status: 403 });
}

function isOrgChartDocumentPath(pathname: string): boolean {
  return (
    pathname === '/org-chart' || pathname.startsWith('/org-chart/')
  );
}

export async function middleware(request: NextRequest) {
  const staticAssetGate = handleNextStaticAssetGate(request);
  if (staticAssetGate) {
    return staticAssetGate;
  }

  if (isMalformedServerActionStylePost(request)) {
    return new NextResponse(null, { status: 400 });
  }

  const pathname = request.nextUrl.pathname;
  const orgChartProfile = resolveOrgChartRateLimitProfile(pathname);
  const guardResult = orgChartProfile
    ? await checkOrgChartApiGuard(request.headers, pathname)
    : null;

  if (orgChartProfile && guardResult && !guardResult.allowed) {
    return orgChartApiGuardToResponse(guardResult, orgChartProfile);
  }

  const requestHeaders = new Headers(request.headers);
  const guardAllowed = guardResult?.allowed === true ? guardResult : null;
  const isLikelyBrowser =
    guardAllowed?.isLikelyBrowser ?? resolveIsLikelyBrowser(request.headers);

  let isVerifiedBot = guardAllowed?.isVerifiedBot ?? false;
  if (!guardResult && isOrgChartDocumentPath(pathname)) {
    const clientIp = getClientIpFromHeaders(request.headers);
    isVerifiedBot =
      clientIp !== null ? await isVerifiedSearchBot(clientIp) : false;
  }

  const staticOnly = resolveOrgChartStaticOnly({
    headers: request.headers,
    isVerifiedBot,
  });

  if (isOrgChartDocumentPath(pathname)) {
    requestHeaders.set(ORG_CHART_STATIC_ONLY_HEADER, staticOnly ? '1' : '0');
  }

  if (orgChartProfile && guardAllowed) {
    applyOrgChartLikelyBrowserRequestHeader(requestHeaders);
    applyOrgChartVerifiedBotRequestHeader(
      requestHeaders,
      guardAllowed.isVerifiedBot,
    );
  }

  if (!requestHeaders.get('origin')) {
    const proto =
      requestHeaders.get('x-forwarded-proto') ||
      (request.url.startsWith('https') ? 'https' : 'http');
    const host =
      requestHeaders.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'arxena.com';
    requestHeaders.set('origin', `${proto}://${host}`);
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (
    isOrgChartDocumentPath(pathname) &&
    !staticOnly &&
    isLikelyBrowser &&
    request.method === 'GET'
  ) {
    res.cookies.set(getArxStaticCookieOptions());
  }

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
  matcher: ['/((?!_next/image|favicon\\.ico).*)'],
};
