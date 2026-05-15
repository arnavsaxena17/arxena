import dns from 'node:dns/promises';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  value: boolean;
  expiresAt: number;
};

const verificationCache = new Map<string, CacheEntry>();

const isIpv4 = (ip: string): boolean => {
  const parts = ip.split('.');
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

const parseIpv4Cidr = (
  cidr: string,
): { network: number; mask: number } | null => {
  const trimmed = cidr.trim();
  if (!trimmed.includes('/')) {
    return null;
  }
  const [ipPart, prefixPart] = trimmed.split('/');
  const prefix = Number(prefixPart);
  if (!isIpv4(ipPart) || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { network: ipv4ToInt(ipPart) & mask, mask };
};

const isIpv4InCidr = (ip: string, cidr: string): boolean => {
  const parsed = parseIpv4Cidr(cidr);
  if (!parsed || !isIpv4(ip)) {
    return false;
  }
  const ipInt = ipv4ToInt(ip);
  return (ipInt & parsed.mask) === parsed.network;
};

const readCache = (ip: string): boolean | null => {
  const entry = verificationCache.get(ip);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    verificationCache.delete(ip);
    return null;
  }
  return entry.value;
};

const writeCache = (ip: string, value: boolean): void => {
  verificationCache.set(ip, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const reverseDnsHostnames = async (ip: string): Promise<string[]> => {
  try {
    return await dns.reverse(ip);
  } catch {
    return [];
  }
};

const forwardDnsIncludesIp = async (
  hostname: string,
  ip: string,
): Promise<boolean> => {
  try {
    const addresses = await dns.resolve4(hostname);
    return addresses.includes(ip);
  } catch {
    return false;
  }
};

const verifyReverseForwardDns = async (
  ip: string,
  hostnameSuffixes: string[],
): Promise<boolean> => {
  const hostnames = await reverseDnsHostnames(ip);
  for (const hostname of hostnames) {
    const lower = hostname.toLowerCase();
    const matchesSuffix = hostnameSuffixes.some((suffix) =>
      lower.endsWith(suffix),
    );
    if (!matchesSuffix) {
      continue;
    }
    if (await forwardDnsIncludesIp(hostname, ip)) {
      return true;
    }
  }
  return false;
};

export const isVerifiedGooglebot = async (ip: string): Promise<boolean> => {
  if (!isIpv4(ip)) {
    return false;
  }
  return verifyReverseForwardDns(ip, ['.googlebot.com', '.google.com']);
};

export const isVerifiedBingbot = async (ip: string): Promise<boolean> => {
  if (!isIpv4(ip)) {
    return false;
  }
  return verifyReverseForwardDns(ip, ['.search.msn.com']);
};

const getOpenAiBotCidrs = (): string[] => {
  const raw = process.env.ORG_CHART_OPENAI_BOT_CIDRS ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

export const isVerifiedOpenAIBot = async (ip: string): Promise<boolean> => {
  if (!isIpv4(ip)) {
    return false;
  }
  const cidrs = getOpenAiBotCidrs();
  if (cidrs.length === 0) {
    return false;
  }
  return cidrs.some((cidr) => isIpv4InCidr(ip, cidr));
};

export const isVerifiedSearchBot = async (
  ip: string | null | undefined,
): Promise<boolean> => {
  if (!ip || ip === 'unknown' || !isIpv4(ip)) {
    return false;
  }

  const cached = readCache(ip);
  if (cached !== null) {
    return cached;
  }

  const allowVerified =
    process.env.ORG_CHART_ALLOW_VERIFIED_BOTS !== '0' &&
    process.env.ORG_CHART_ALLOW_VERIFIED_BOTS !== 'false';
  if (!allowVerified) {
    writeCache(ip, false);
    return false;
  }

  let verified = false;
  if (await isVerifiedGooglebot(ip)) {
    verified = true;
  } else if (await isVerifiedBingbot(ip)) {
    verified = true;
  } else if (await isVerifiedOpenAIBot(ip)) {
    verified = true;
  }

  writeCache(ip, verified);
  return verified;
};

/** @internal Test helper */
export const clearVerifiedSearchBotCacheForTests = (): void => {
  verificationCache.clear();
};
