const MAX_IP_OR_CIDR_LEN = 64;

export const isIpv4 = (value: string): boolean => {
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

export const parseIpv4Cidr = (
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

export const isIpv4InCidr = (ip: string, cidr: string): boolean => {
  const parsed = parseIpv4Cidr(cidr);
  if (!parsed || !isIpv4(ip)) {
    return false;
  }
  const ipInt = ipv4ToInt(ip);
  return (ipInt & parsed.mask) === parsed.network;
};

export const isCidrNotation = (value: string): boolean => value.includes('/');

/** Validates and normalizes a single IPv4 address or IPv4 CIDR (e.g. 43.173.0.0/16). */
export const normalizeIpOrCidr = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_IP_OR_CIDR_LEN) {
    return null;
  }
  if (isCidrNotation(trimmed)) {
    return parseIpv4Cidr(trimmed) ? trimmed : null;
  }
  return isIpv4(trimmed) ? trimmed : null;
};
