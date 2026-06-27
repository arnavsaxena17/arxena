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

/**
 * Extension cookie sync sends `li_at` / `li_a` as strings; empty string means "no cookie" and should clear DB.
 * Omitted fields are left unchanged on the workspace member profile.
 */
export const parseExtensionLinkedinCookieToken = (
  value?: string,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

/**
 * True when the extension sends a first-time valid `li_a`, the profile already has
 * `li_at` stored, stored `li_a` is absent, and `li_at` is unchanged in the request.
 */
export const shouldDisconnectStoredLinkedinAccountForNewLiA = (args: {
  storedLiAt: string | null;
  storedLiA: string | null;
  incomingLiAt: string | null | undefined;
  incomingLiA: string | null | undefined;
}): boolean => {
  if (!args.storedLiAt?.trim()) {
    return false;
  }

  if (args.storedLiA?.trim()) {
    return false;
  }

  if (typeof args.incomingLiA !== 'string' || !args.incomingLiA.trim()) {
    return false;
  }

  return (
    args.incomingLiAt === undefined || args.incomingLiAt === args.storedLiAt
  );
};

export const assertNonEmptyLinkedinLiAtForUnipileConnect = (
  accessToken?: string | null,
): string => {
  const trimmed = accessToken?.trim() ?? '';
  if (!trimmed) {
    throw new Error(
      'Cannot POST /api/v1/accounts without a non-empty LinkedIn li_at access_token',
    );
  }

  return trimmed;
};

export const resolveLinkedinConnectUserAgent = (args: {
  storedUserAgent?: string | null;
  requestUserAgent?: string | null;
}): string | undefined => {
  const stored = args.storedUserAgent?.trim();
  if (stored) {
    return stored;
  }

  const request = args.requestUserAgent?.trim();
  return request || undefined;
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
  const accessToken = assertNonEmptyLinkedinLiAtForUnipileConnect(
    params.accessToken,
  );

  const body: Record<string, unknown> = {
    provider: 'LINKEDIN',
    access_token: accessToken,
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

  console.log(`Body in BUILD UNIPILE LINKEDIN COOKIE CONNECT BODY: ${JSON.stringify(body, null, 2)}`);

  return body;
};
