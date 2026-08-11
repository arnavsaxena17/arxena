import { isPrivateOrLocalClientIp } from './isPrivateOrLocalClientIp';
import { resolveIpinfoToken } from './resolveIpinfoToken';

const IPINFO_API_BASE = 'https://ipinfo.io';
const LOOKUP_TIMEOUT_MS = 3_000;

export type IpInfoCompanyResponse = {
  /** ipinfo "org" field (e.g. "AS15169 Google LLC"). Only present on paid plans. */
  org: string | null;
  /** ipinfo "hostname" field (PTR/rDNS). Only present on paid plans. */
  hostname: string | null;
};

type IpInfoLookupResponse = {
  org?: string;
  hostname?: string;
};

/**
 * Per-IP company/org lookup via ipinfo.
 *
 * NOTE: the `org` and `hostname` fields are only returned on ipinfo paid
 * plans (Standard/Pro). On the free tier the response contains only
 * country/city/region, so both fields return null and callers should fall
 * back to another source (e.g. RIPE ASN resolution).
 */
export const lookupCompanyByIp = async (
  clientIp: string,
): Promise<IpInfoCompanyResponse> => {
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
    return { org: null, hostname: null };
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
      console.warn('[lookupCompanyByIp] ipinfo lookup failed', {
        clientIp: normalizedIp,
        status: response.status,
      });
      return { org: null, hostname: null };
    }

    const data = (await response.json()) as IpInfoLookupResponse;
    return {
      org: data.org?.trim() || null,
      hostname: data.hostname?.trim() || null,
    };
  } catch (error) {
    console.warn('[lookupCompanyByIp] ipinfo lookup error', {
      clientIp: normalizedIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return { org: null, hostname: null };
  }
};
