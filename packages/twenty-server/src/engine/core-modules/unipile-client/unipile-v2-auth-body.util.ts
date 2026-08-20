import { UNIPILE_V2_DEFAULT_USER_AGENT } from './unipile-v2.constants';

export const toUnipileV2Provider = (provider: string): string =>
  provider.trim().toLowerCase();

export const buildUnipileV2LinkedinCookieAuthIntentBody = (params: {
  accessToken: string;
  premiumToken?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
  reconnectAccountId?: string | null;
}): Record<string, unknown> => {
  const credentials: Record<string, unknown> = {
    access_token: params.accessToken,
    user_agent: params.userAgent?.trim() || UNIPILE_V2_DEFAULT_USER_AGENT,
  };
  const premiumToken = params.premiumToken?.trim();
  if (premiumToken) {
    credentials.premium_access_token = premiumToken;
  }

  const body: Record<string, unknown> = {
    provider: 'linkedin',
    credentials,
  };

  const reconnectAccountId = params.reconnectAccountId?.trim();
  if (reconnectAccountId) {
    body.account_id = reconnectAccountId;
  }

  const autoProxyConfig: Record<string, string> = {};
  if (params.country?.trim()) {
    autoProxyConfig.country = params.country.trim().toUpperCase();
  }
  if (params.ip?.trim()) {
    autoProxyConfig.ip = params.ip.trim();
  }
  if (Object.keys(autoProxyConfig).length > 0) {
    body.config = { auto_proxy_config: autoProxyConfig };
  }

  return body;
};

export const buildUnipileV2LinkedinCredentialsAuthIntentBody = (params: {
  username: string;
  password: string;
  userAgent?: string | null;
  reconnectAccountId?: string | null;
}): Record<string, unknown> => {
  const credentials: Record<string, unknown> = {
    username: params.username,
    password: params.password,
  };
  if (params.userAgent?.trim()) {
    credentials.user_agent = params.userAgent.trim();
  }

  const body: Record<string, unknown> = {
    provider: 'linkedin',
    credentials,
  };
  const reconnectAccountId = params.reconnectAccountId?.trim();
  if (reconnectAccountId) {
    body.account_id = reconnectAccountId;
  }
  return body;
};

export const buildUnipileV2WhatsappQrAuthIntentBody = (params?: {
  reconnectAccountId?: string | null;
}): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    provider: 'whatsapp',
    credentials: { qrcode: true },
  };
  const reconnectAccountId = params?.reconnectAccountId?.trim();
  if (reconnectAccountId) {
    body.account_id = reconnectAccountId;
  }
  return body;
};

export const buildUnipileV2HostedAuthLinkBody = (params: {
  providers?: string[];
  expiresOn?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  name?: string;
  reconnectAccountId?: string | null;
}): Record<string, unknown> => {
  const redirectUri =
    params.successRedirectUrl?.trim() ||
    params.failureRedirectUrl?.trim() ||
    process.env.SERVER_URL ||
    'https://localhost';
  const providers = (params.providers ?? ['LINKEDIN']).map(toUnipileV2Provider);
  const body: Record<string, unknown> = {
    expires_on:
      params.expiresOn ||
      new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    redirect_uri: redirectUri,
    providers,
    state: params.name,
  };
  const reconnectAccountId = params.reconnectAccountId?.trim();
  if (reconnectAccountId) {
    body.account_id = reconnectAccountId;
  }
  if (providers.includes('whatsapp')) {
    body.config = {
      global: { wait_initial_sync: true },
    };
  }
  return body;
};
