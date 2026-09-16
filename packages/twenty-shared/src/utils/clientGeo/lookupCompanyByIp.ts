import { fetchIpInfoLookup } from './fetchIpInfoLookup';

export type IpInfoCompanyResponse = {
  /** ipinfo "org" field (e.g. "AS15169 Google LLC"). Only present on paid plans. */
  org: string | null;
  /** ipinfo "hostname" field (PTR/rDNS). Only present on paid plans. */
  hostname: string | null;
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
  const payload = await fetchIpInfoLookup(clientIp);
  return {
    org: payload.org,
    hostname: payload.hostname,
  };
};
