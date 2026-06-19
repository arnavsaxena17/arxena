import { type ClientGeoSession } from './clientGeoSession.types';

export const attachClientGeoToLinkedinBody = <T extends object>(
  body: T,
  session: ClientGeoSession | null | undefined,
): T & { client_ip?: string; client_country?: string } => {
  if (!session?.ip && !session?.country) {
    return body;
  }

  return {
    ...body,
    ...(session.ip ? { client_ip: session.ip } : {}),
    ...(session.country ? { client_country: session.country } : {}),
  };
};

export const attachClientGeoToCookieAuth = <T extends object>(
  body: T,
  session: ClientGeoSession | null | undefined,
): T & { ip?: string; country?: string } => {
  if (!session?.ip && !session?.country) {
    return body;
  }

  return {
    ...body,
    ...(session.ip ? { ip: session.ip } : {}),
    ...(session.country ? { country: session.country } : {}),
  };
};

export const buildClientGeoHeaders = (
  session: ClientGeoSession | null | undefined,
): Record<string, string> => {
  if (!session) {
    return {};
  }

  const headers: Record<string, string> = {};
  if (session.ip) {
    headers['x-client-geo-ip'] = session.ip;
  }
  if (session.country) {
    headers['x-client-geo-country'] = session.country;
  }
  return headers;
};
