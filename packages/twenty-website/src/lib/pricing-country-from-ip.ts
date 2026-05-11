const IPINFO_API_BASE = 'https://ipinfo.io';
const DEFAULT_IPINFO_TOKEN = '49074596a34362';

type IpInfoLookupResponse = {
  country?: string;
};

function isPrivateOrLocalIp(ip: string): boolean {
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  if (ip.includes(':')) {
    return false;
  }
  if (ip.startsWith('127.') || ip.startsWith('10.')) {
    return true;
  }
  if (ip.startsWith('192.168.')) {
    return true;
  }
  const secondOctet = Number(ip.split('.')[1]);
  if (ip.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31) {
    return true;
  }
  return false;
}

export async function resolveCountryCodeFromClientIp(
  clientIp: string,
): Promise<string | null> {
  
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalIp(normalizedIp)) {
    return null;
  }

  const token = process.env.IPINFO_TOKEN?.trim() || DEFAULT_IPINFO_TOKEN;

  const url = `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}?token=${encodeURIComponent(token)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn('[Pricing geo] ipinfo lookup failed', {
        clientIp: normalizedIp,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as IpInfoLookupResponse;
    const countryCode = data.country?.trim().toUpperCase();
    return countryCode || null;
  } catch (error) {
    console.warn('[Pricing geo] ipinfo lookup error', {
      clientIp: normalizedIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
