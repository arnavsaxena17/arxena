/**
 * User-Agent patterns for known unauthorized crawlers and scrapers.
 * These are typically SEO tools, data scrapers, or bots that abuse API endpoints.
 * Legitimate search engines (Googlebot, Bingbot) are NOT included - they crawl
 * pages for indexing; we allow them.
 */
const BLOCKED_BOT_PATTERNS = [
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /serpstatbot/i,
  /scrapy/i,
  /httrack/i,
  /sqlmap/i,
  /bytespider/i,
  /ccbot/i,
  /petalbot/i,
  /dataforseo/i,
  /sogou/i,
  /mail\.ru_bot/i,
  /nimbostratus/i,
  /webtechbot/i,
  /clickagy/i,
  /rogerbot/i,
  /exabot/i,
  /blexbot/i,
];

/** Self-declared crawlers (bingbot, SeznamBot, GPTBot, etc.) — not treated as scrapers. */
const DECLARED_BOT_UA_PATTERN =
  /bot|crawler|spider|scraper|bytespider|petalbot/i;

/**
 * Returns true if the User-Agent indicates an unauthorized crawler/scraper.
 * Only blocks when we have a positive match; empty/missing User-Agent is allowed
 * (e.g. server-side fetches, some legitimate clients).
 */
export function isBlockedBot(userAgent: string | null): boolean {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }
  const ua = userAgent.trim();
  if (ua.length === 0) return false;

  return BLOCKED_BOT_PATTERNS.some((pattern) => pattern.test(ua));
}

/**
 * User-Agent explicitly identifies as a bot/crawler (e.g. bingbot, SeznamBot).
 * These are excluded from suspected_scraper logging and enforce-mode blocks.
 */
export const isDeclaredBotUserAgent = (userAgent: string | null): boolean => {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }
  const ua = userAgent.trim();
  if (ua.length === 0) {
    return false;
  }
  return DECLARED_BOT_UA_PATTERN.test(ua);
};

/**
 * CloudFront sends viewer IP as `IPv4:port` or `[IPv6]:port` in this header
 * when the origin request policy includes CloudFront-Viewer-Address.
 */
export function parseCloudFrontViewerAddress(
  raw: string | null | undefined,
): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']');
    if (close === -1) {
      return null;
    }
    const ip = trimmed.slice(1, close).trim();
    return ip.length > 0 ? ip : null;
  }
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon === -1) {
    return trimmed;
  }
  const possiblePort = trimmed.slice(lastColon + 1);
  if (/^\d{1,5}$/.test(possiblePort)) {
    const host = trimmed.slice(0, lastColon).trim();
    return host.length > 0 ? host : null;
  }
  return trimmed;
}

/**
 * Best-effort client IP behind CloudFront, ALB, nginx, etc.
 * Prefer CloudFront-Viewer-Address when present (reliable viewer IP from AWS).
 */
export function getClientIpFromHeaders(headers: Headers): string | null {
  const cfViewer = parseCloudFrontViewerAddress(
    headers.get('cloudfront-viewer-address'),
  );
  if (cfViewer) {
    return cfViewer;
  }
  const cfConnecting = headers.get('cf-connecting-ip')?.trim();
  if (cfConnecting) {
    return cfConnecting;
  }
  const trueClient = headers.get('true-client-ip')?.trim();
  if (trueClient) {
    return trueClient;
  }
  const xff = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (xff) {
    return xff;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }
  return null;
}

/**
 * Returns request metadata for logging (User-Agent, referer, IP).
 */
export function getRequestMetadata(request: Request): {
  userAgent: string | null;
  referer: string | null;
  clientIp: string | null;
} {
  const headers = request.headers;
  return {
    userAgent: headers.get('user-agent'),
    referer: headers.get('referer'),
    clientIp: getClientIpFromHeaders(headers),
  };
}
