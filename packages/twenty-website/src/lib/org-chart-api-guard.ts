import { isLikelyBrowserRequest } from 'twenty-shared';

import { getClientIpFromHeaders, isBlockedBot } from '@/lib/bot-detection';

export const ORG_CHART_LIKELY_BROWSER_HEADER = 'x-org-chart-likely-browser';

export type OrgChartRateLimitProfile =
  | 'sitemap'
  | 'expensive'
  | 'default'
  | 'page';

export type OrgChartApiGuardResult =
  | { allowed: true; isLikelyBrowser: boolean }
  | { allowed: false; status: number; body: Record<string, unknown> };

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

const WINDOW_MS = 60_000;

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
): number => {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const isGuardDisabled = (): boolean =>
  process.env.ORG_CHART_API_GUARD_DISABLED === '1' ||
  process.env.ORG_CHART_API_GUARD_DISABLED === 'true';

const getMaxRequestsForProfile = (profile: OrgChartRateLimitProfile): number => {
  switch (profile) {
    case 'sitemap':
      return parsePositiveInt(
        process.env.ORG_CHART_API_RATE_LIMIT_SITEMAP_MAX,
        600,
      );
    case 'expensive':
      return parsePositiveInt(
        process.env.ORG_CHART_API_RATE_LIMIT_EXPENSIVE_MAX,
        20,
      );
    case 'page':
      return parsePositiveInt(
        process.env.ORG_CHART_PAGE_RATE_LIMIT_MAX,
        120,
      );
    case 'default':
      return parsePositiveInt(process.env.ORG_CHART_API_RATE_LIMIT_MAX, 60);
  }
};

const pruneRateBuckets = (): void => {
  if (rateBuckets.size < 10_000) {
    return;
  }
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) {
      rateBuckets.delete(key);
    }
  }
};

const consumeRateLimit = (
  key: string,
  maxRequests: number,
): { allowed: boolean; retryAfterSeconds: number } => {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  pruneRateBuckets();

  if (bucket.count > maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
};

export const resolveOrgChartRateLimitProfile = (
  pathname: string,
): OrgChartRateLimitProfile | null => {
  if (pathname.startsWith('/api/org-chart/companies/sitemap')) {
    return 'sitemap';
  }
  if (
    pathname.includes('/sitemap-batch') ||
    pathname.includes('/sitemap-index') ||
    pathname.includes('/sitemap-urls') ||
    pathname.includes('/sitemap-global')
  ) {
    return 'sitemap';
  }
  if (
    pathname.includes('/autocomplete') ||
    pathname.includes('/company-logo') ||
    pathname.includes('/employee-count')
  ) {
    return 'expensive';
  }
  if (pathname.startsWith('/api/org-chart')) {
    return 'default';
  }
  if (pathname.startsWith('/org-chart')) {
    return 'page';
  }
  return null;
};

export const resolveIsLikelyBrowser = (headers: Headers): boolean => {
  if (headers.get(ORG_CHART_LIKELY_BROWSER_HEADER) === '1') {
    return true;
  }
  return isLikelyBrowserRequest(headers);
};

export const checkOrgChartApiGuard = (
  headers: Headers,
  pathname: string,
): OrgChartApiGuardResult => {
  const profile = resolveOrgChartRateLimitProfile(pathname);
  if (!profile || isGuardDisabled()) {
    return { allowed: true, isLikelyBrowser: resolveIsLikelyBrowser(headers) };
  }

  const forwardedUserAgent = headers.get('x-forwarded-user-agent');
  const userAgent = forwardedUserAgent ?? headers.get('user-agent');
  if (isBlockedBot(userAgent)) {
    return {
      allowed: false,
      status: 403,
      body: { status: 'error', message: 'Forbidden' },
    };
  }

  const clientIp = getClientIpFromHeaders(headers) ?? 'unknown';
  const rateKey = `${profile}:${clientIp}`;
  const maxRequests = getMaxRequestsForProfile(profile);
  const rateDecision = consumeRateLimit(rateKey, maxRequests);
  if (!rateDecision.allowed) {
    return {
      allowed: false,
      status: 429,
      body: {
        status: 'error',
        message: 'Too many requests',
        retryAfterSeconds: rateDecision.retryAfterSeconds,
      },
    };
  }

  return { allowed: true, isLikelyBrowser: resolveIsLikelyBrowser(headers) };
};

export const applyOrgChartLikelyBrowserRequestHeader = (
  requestHeaders: Headers,
): void => {
  const isLikelyBrowser = isLikelyBrowserRequest(requestHeaders);
  requestHeaders.set(
    ORG_CHART_LIKELY_BROWSER_HEADER,
    isLikelyBrowser ? '1' : '0',
  );
};

export const orgChartApiGuardToResponse = (
  result: Extract<OrgChartApiGuardResult, { allowed: false }>,
  profile: OrgChartRateLimitProfile,
): Response => {
  const headers: Record<string, string> = {};
  if (result.status === 429 && typeof result.body.retryAfterSeconds === 'number') {
    headers['Retry-After'] = String(result.body.retryAfterSeconds);
  }

  if (profile === 'page') {
    return new Response('Too Many Requests', {
      status: result.status,
      headers: {
        ...headers,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return Response.json(result.body, {
    status: result.status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
};
