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
 * Known crawler patterns for identification (name -> regex).
 * Order matters: first match wins. Include both allowed and blocked bots.
 */
const BOT_IDENTIFY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Googlebot', pattern: /googlebot/i },
  { name: 'Bingbot', pattern: /bingbot/i },
  { name: 'Slurp', pattern: /slurp/i },
  { name: 'DuckDuckBot', pattern: /duckduckbot/i },
  { name: 'Baiduspider', pattern: /baiduspider/i },
  { name: 'YandexBot', pattern: /yandexbot/i },
  { name: 'facebookexternalhit', pattern: /facebookexternalhit/i },
  { name: 'Twitterbot', pattern: /twitterbot/i },
  { name: 'LinkedInBot', pattern: /linkedinbot/i },
  { name: 'Bytespider', pattern: /bytespider/i },
  { name: 'PetalBot', pattern: /petalbot/i },
  { name: 'CCBot', pattern: /ccbot/i },
  { name: 'SemrushBot', pattern: /semrushbot/i },
  { name: 'AhrefsBot', pattern: /ahrefsbot/i },
  { name: 'MJ12bot', pattern: /mj12bot/i },
  { name: 'DotBot', pattern: /dotbot/i },
  { name: 'SerpstatBot', pattern: /serpstatbot/i },
  { name: 'Scrapy', pattern: /scrapy/i },
  { name: 'DataForSeo', pattern: /dataforseo/i },
  { name: 'Rogerbot', pattern: /rogerbot/i },
  { name: 'Exabot', pattern: /exabot/i },
  { name: 'BlexBot', pattern: /blexbot/i },
  { name: 'WebTechBot', pattern: /webtechbot/i },
  { name: 'Clickagy', pattern: /clickagy/i },
  { name: 'Nimbostratus', pattern: /nimbostratus/i },
  { name: 'Sogou', pattern: /sogou/i },
  { name: 'Mail.ru Bot', pattern: /mail\.ru_bot/i },
  { name: 'HTTrack', pattern: /httrack/i },
  { name: 'sqlmap', pattern: /sqlmap/i },
];

/**
 * Identifies the crawler from User-Agent. Returns a friendly name or null if not a known bot.
 */
export function identifyBot(userAgent: string | null): string | null {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const ua = userAgent.trim();
  if (ua.length === 0) return null;

  const match = BOT_IDENTIFY_PATTERNS.find(({ pattern }) => pattern.test(ua));
  return match ? match.name : null;
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
