import { isLikelyBrowserRequest } from 'twenty-shared';

import { getClientIpFromHeaders, isBlockedBot } from '@/lib/bot-detection';

export const ORG_CHART_STATIC_ONLY_HEADER = 'x-org-chart-static-only';

export const ARX_STATIC_ASSET_COOKIE = 'arx_static';

const ARX_STATIC_COOKIE_MAX_AGE_SECONDS = 60 * 60;

const DEFAULT_SCRAPER_CIDRS = ['43.173.0.0/16', '43.172.0.0/16'];

const isIpv4 = (value: string): boolean => {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
};

const ipv4ToInt = (ip: string): number => {
  const [a, b, c, d] = ip.split('.').map((part) => Number(part));
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
};

const isIpv4InCidr = (ip: string, cidr: string): boolean => {
  const trimmed = cidr.trim();
  if (!trimmed.includes('/')) {
    return isIpv4(trimmed) && ip === trimmed;
  }
  const [ipPart, prefixPart] = trimmed.split('/');
  const prefix = Number(prefixPart);
  if (!isIpv4(ipPart) || !isIpv4(ip) || !Number.isInteger(prefix)) {
    return false;
  }
  if (prefix < 0 || prefix > 32) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = ipv4ToInt(ipPart) & mask;
  return (ipv4ToInt(ip) & mask) === network;
};

export const getOrgChartScraperCidrs = (): string[] => {
  const raw = process.env.ORG_CHART_SCRAPER_CIDRS?.trim();
  if (!raw) {
    return DEFAULT_SCRAPER_CIDRS;
  }
  return raw.split(/\s+/).filter((entry) => entry.length > 0);
};

export const isClientIpInScraperCidrs = (clientIp: string | null): boolean => {
  if (!clientIp) {
    return false;
  }
  return getOrgChartScraperCidrs().some((cidr) => isIpv4InCidr(clientIp, cidr));
};

export type ResolveOrgChartStaticOnlyInput = {
  headers: Headers;
  isVerifiedBot: boolean;
};

/**
 * SSR-only org-chart HTML (no interactive client tree) for bots and scrapers.
 */
export const resolveOrgChartStaticOnly = (
  input: ResolveOrgChartStaticOnlyInput,
): boolean => {
  if (input.isVerifiedBot) {
    return true;
  }

  const userAgent = input.headers.get('user-agent');
  if (isBlockedBot(userAgent)) {
    return true;
  }

  if (!isLikelyBrowserRequest(input.headers)) {
    return true;
  }

  const clientIp = getClientIpFromHeaders(input.headers);
  if (isClientIpInScraperCidrs(clientIp)) {
    return true;
  }

  return false;
};

export const readOrgChartStaticOnlyFromHeaders = (
  headers: Headers,
): boolean => headers.get(ORG_CHART_STATIC_ONLY_HEADER) === '1';

export const getArxStaticCookieOptions = (): {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
} => ({
  name: ARX_STATIC_ASSET_COOKIE,
  value: '1',
  maxAge: ARX_STATIC_COOKIE_MAX_AGE_SECONDS,
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
});

export const hasArxStaticAssetCookie = (
  cookies: { get: (name: string) => { value: string } | undefined },
): boolean => cookies.get(ARX_STATIC_ASSET_COOKIE)?.value === '1';

export const isOrgChartStaticAssetRequest = (referer: string | null): boolean =>
  Boolean(referer?.includes('/org-chart') || referer?.includes('/org/'));
