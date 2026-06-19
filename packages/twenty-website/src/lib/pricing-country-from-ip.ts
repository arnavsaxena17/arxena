import { isPrivateOrLocalClientIp } from 'twenty-shared';

import { lookupCountryByIp } from './lookup-country-by-ip.util';

export async function resolveCountryCodeFromClientIp(
  clientIp: string,
): Promise<string | null> {
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
    return null;
  }

  return lookupCountryByIp(normalizedIp);
}
