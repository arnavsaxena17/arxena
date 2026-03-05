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
    clientIp:
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      headers.get('x-real-ip'),
  };
}
