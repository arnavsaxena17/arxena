import { ORG_CHART_VERIFIED_BOT_HEADER } from '@/constants/org-chart-guard.constant';

// Matches Meta meta-externalagent, Googlebot, bingbot, bytespider, etc.
const DECLARED_BOT_UA_PATTERN =
  /bot|crawler|spider|scraper|bytespider|petalbot|facebookexternalhit|meta-externalagent|slurp|duckduckbot|yandex|baiduspider|semrush|ahrefs|mj12bot|dotbot/i;

const readHeaderValue = (
  getHeader: (name: string) => string | string[] | null | undefined,
  name: string,
): string | null => {
  const raw = getHeader(name);
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    const first = raw[0].trim();
    return first.length > 0 ? first : null;
  }
  return null;
};

export const isDeclaredBotUserAgent = (
  userAgent: string | null | undefined,
): boolean => {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }
  const normalized = userAgent.trim();
  if (normalized.length === 0) {
    return false;
  }
  return DECLARED_BOT_UA_PATTERN.test(normalized);
};

// Skip paid ipinfo lookups for verified/declared bots (header or User-Agent).
export const shouldSkipIpInfoLookup = (
  getHeader: (name: string) => string | string[] | null | undefined,
): boolean => {
  const verifiedBot = readHeaderValue(getHeader, ORG_CHART_VERIFIED_BOT_HEADER);
  if (verifiedBot === '1') {
    return true;
  }
  return isDeclaredBotUserAgent(readHeaderValue(getHeader, 'user-agent'));
};
