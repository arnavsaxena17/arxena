import { isPrivateOrLocalClientIp } from 'twenty-shared';

const IPINFO_API_BASE = 'https://ipinfo.io';

type IpInfoLookupResponse = {
  country?: string;
};

const resolveIpinfoToken = (): string | undefined => {
  return process.env.IPINFO_TOKEN?.trim() || undefined;
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
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn('[IpInfoGeo] lookup failed', {
        clientIp: normalizedIp,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as IpInfoLookupResponse;
    const countryCode = data.country?.trim().toUpperCase();
    return countryCode || null;
  } catch (error) {
    console.warn('[IpInfoGeo] lookup error', {
      clientIp: normalizedIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
