import { isPrivateOrLocalClientIp } from 'twenty-shared';

import { lookupCountryByIp } from 'src/engine/core-modules/geo/utils/lookup-country-by-ip.util';

export const isPrivateOrLocalLinkedinConnectionIp = isPrivateOrLocalClientIp;

export const resolveLinkedinCountryFromIp = async (
  clientIp: string,
): Promise<string | null> => {
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
    return null;
  }

  return lookupCountryByIp(normalizedIp);
};
