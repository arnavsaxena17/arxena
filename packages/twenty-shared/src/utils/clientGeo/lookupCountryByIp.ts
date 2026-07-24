import { isPrivateOrLocalClientIp } from './isPrivateOrLocalClientIp';
import { resolveIpinfoToken } from './resolveIpinfoToken';

const IPINFO_API_BASE = 'https://ipinfo.io';
const LOOKUP_TIMEOUT_MS = 3_000;

type IpInfoLookupResponse = {
  country?: string;
};

export const lookupCountryByIp = async (
  clientIp: string,
): Promise<string | null> => {
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
    return null;
  }

  const token = resolveIpinfoToken();
  const url = token
    ? `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}?token=${encodeURIComponent(token)}`
    : `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[lookupCountryByIp] ipinfo lookup failed', {
        clientIp: normalizedIp,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as IpInfoLookupResponse;
    const countryCode = data.country?.trim().toUpperCase();
    return countryCode || null;
  } catch (error) {
    console.warn('[lookupCountryByIp] ipinfo lookup error', {
      clientIp: normalizedIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
