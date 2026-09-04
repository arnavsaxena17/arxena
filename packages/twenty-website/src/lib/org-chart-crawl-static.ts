import { getClientIpFromHeaders } from '@/lib/bot-detection';

export const ORG_CHART_CRAWL_STATIC_HEADER = 'x-org-chart-crawl-static';

type UniquePathWindow = {
  companyKeys: Set<string>;
  resetAt: number;
};

const uniquePathWindows = new Map<string, UniquePathWindow>();
const crawlStaticUntil = new Map<string, number>();

const WINDOW_MS_DEFAULT = 60_000;
const UNIQUE_PAGES_DEFAULT = 8;
const STATIC_TTL_MS_DEFAULT = 15 * 60 * 1000;
const PRUNE_MAP_SIZE = 10_000;

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

export const getOrgChartCrawlWindowMs = (): number =>
  parsePositiveInt(
    process.env.ORG_CHART_CRAWL_WINDOW_MS,
    WINDOW_MS_DEFAULT,
  );

export const getOrgChartCrawlUniquePagesMax = (): number =>
  parsePositiveInt(
    process.env.ORG_CHART_CRAWL_UNIQUE_PAGES_MAX,
    UNIQUE_PAGES_DEFAULT,
  );

export const getOrgChartCrawlStaticTtlMs = (): number =>
  parsePositiveInt(
    process.env.ORG_CHART_CRAWL_STATIC_TTL_MS,
    STATIC_TTL_MS_DEFAULT,
  );

const pruneCrawlMaps = (now: number): void => {
  if (
    uniquePathWindows.size + crawlStaticUntil.size <
    PRUNE_MAP_SIZE
  ) {
    return;
  }
  for (const [ip, window] of uniquePathWindows) {
    if (now >= window.resetAt) {
      uniquePathWindows.delete(ip);
    }
  }
  for (const [ip, until] of crawlStaticUntil) {
    if (now >= until) {
      crawlStaticUntil.delete(ip);
    }
  }
};

export const extractOrgChartCompanyKeyFromPath = (
  pathname: string,
): string | null => {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const parts = decoded.toLowerCase().split('/').filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (parts[0] === 'org-chart') {
    if (parts.length < 2 || parts[1] === 'share') {
      return null;
    }
    return parts[1];
  }

  if (parts[0] === 'org') {
    if (parts.length < 2) {
      return null;
    }
    return parts[1];
  }

  if (parts[0] === 'embed') {
    if (parts[1] === 'org-chart' && parts[2]) {
      return parts[2];
    }
    if (parts[1] && parts[1] !== 'org-chart') {
      return parts[1];
    }
    return null;
  }

  return null;
};

export const isOrgChartCrawlStaticOnly = (clientIp: string | null): boolean => {
  if (!clientIp) {
    return false;
  }
  const until = crawlStaticUntil.get(clientIp);
  return typeof until === 'number' && until > Date.now();
};

export const recordOrgChartCompanyView = (
  clientIp: string,
  companyKey: string,
): boolean => {
  const now = Date.now();
  pruneCrawlMaps(now);

  const staticTtlMs = getOrgChartCrawlStaticTtlMs();
  const existingUntil = crawlStaticUntil.get(clientIp);
  if (typeof existingUntil === 'number' && existingUntil > now) {
    crawlStaticUntil.set(clientIp, now + staticTtlMs);
    return true;
  }

  const windowMs = getOrgChartCrawlWindowMs();
  let window = uniquePathWindows.get(clientIp);
  if (!window || now >= window.resetAt) {
    window = { companyKeys: new Set(), resetAt: now + windowMs };
    uniquePathWindows.set(clientIp, window);
  }
  window.companyKeys.add(companyKey);

  if (window.companyKeys.size >= getOrgChartCrawlUniquePagesMax()) {
    crawlStaticUntil.set(clientIp, now + staticTtlMs);
    console.warn('[OrgChart guard] crawl_static_only', {
      clientIp,
      uniqueCompanyCount: window.companyKeys.size,
      companyKey,
      timestamp: now,
    });
    return true;
  }

  return false;
};

export const recordOrgChartDocumentViewFromPath = (
  clientIp: string | null,
  pathname: string,
): boolean => {
  if (!clientIp) {
    return false;
  }
  const companyKey = extractOrgChartCompanyKeyFromPath(pathname);
  if (!companyKey) {
    return isOrgChartCrawlStaticOnly(clientIp);
  }
  return recordOrgChartCompanyView(clientIp, companyKey);
};

export const isOrgChartCrawlStaticRequest = (headers: Headers): boolean => {
  if (headers.get(ORG_CHART_CRAWL_STATIC_HEADER) === '1') {
    return true;
  }
  return isOrgChartCrawlStaticOnly(getClientIpFromHeaders(headers));
};

export const resetOrgChartCrawlStaticStateForTests = (): void => {
  uniquePathWindows.clear();
  crawlStaticUntil.clear();
};
