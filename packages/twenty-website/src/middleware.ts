import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

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
