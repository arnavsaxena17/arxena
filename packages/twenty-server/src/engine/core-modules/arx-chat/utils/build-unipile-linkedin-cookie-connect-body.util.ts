export type LinkedinUnipileCookieConnectParams = {
  accessToken: string;
  premiumToken?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  reconnectAccountId?: string | null;
};

const ISO3166_ALPHA2 = /^[A-Z]{2}$/;

export const normalizeLinkedinConnectionCountry = (
  value?: string | null,
): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  if (!ISO3166_ALPHA2.test(normalized)) {
    return undefined;
  }

  return normalized;
};

export const normalizeLinkedinConnectionIp = (
  value?: string | null,
): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.includes(':')) {
    return undefined;
  }

  return trimmed;
};

export const buildUnipileLinkedinCookieConnectBody = (
  params: LinkedinUnipileCookieConnectParams,
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    provider: 'LINKEDIN',
    access_token: params.accessToken.trim(),
  };

  const premiumToken = params.premiumToken?.trim();
  if (premiumToken) {
    body.premium_token = premiumToken;
  }

  const userAgent = params.userAgent?.trim();
  if (userAgent) {
    body.user_agent = userAgent;
  }

  const ip = normalizeLinkedinConnectionIp(params.ip);
  if (ip) {
    body.ip = ip;
  }

  const country = normalizeLinkedinConnectionCountry(params.country);
  if (country) {
    body.country = country;
  }

  const reconnectAccountId = params.reconnectAccountId?.trim();
  if (reconnectAccountId) {
    body.reconnect_account = reconnectAccountId;
  }

  return body;
};
