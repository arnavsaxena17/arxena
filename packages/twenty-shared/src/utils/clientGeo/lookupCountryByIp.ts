import { fetchIpInfoLookup } from './fetchIpInfoLookup';

export const lookupCountryByIp = async (
  clientIp: string,
): Promise<string | null> => {
  const payload = await fetchIpInfoLookup(clientIp);
  return payload.country;
};
