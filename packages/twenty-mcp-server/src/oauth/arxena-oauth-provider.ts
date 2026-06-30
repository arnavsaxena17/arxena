import { createHash, randomBytes } from 'node:crypto';

import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
    AuthorizationParams,
    OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Response } from 'express';

import {
    buildArxenaConfigFromToken,
    createAuthInfoFromToken,
    validateApiToken,
} from '../auth';
import { HttpServerConfig } from '../config';

type PendingAuthorization = {
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  apiToken: string;
  expiresAt: number;
};

type RefreshRecord = {
  apiToken: string;
  clientId: string;
  expiresAt: number;
};

const clients = new Map<string, OAuthClientInformationFull>();
const pendingAuthorizations = new Map<string, PendingAuthorization>();
const refreshTokens = new Map<string, RefreshRecord>();

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

const generateId = (): string => randomBytes(24).toString('hex');

export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): OAuthClientInformationFull {
    const clientId = generateId();
    const registered: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    clients.set(clientId, registered);
    return registered;
  }
}

export class ArxenaOAuthProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();

  constructor(private readonly config: HttpServerConfig) {}

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const query = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      state: params.state ?? '',
      code_challenge: params.codeChallenge,
      resource: params.resource?.toString() ?? this.config.mcpPublicUrl,
    });

    res.redirect(302, `/oauth/consent?${query.toString()}`);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const pending = pendingAuthorizations.get(authorizationCode);
    if (!pending) {
      throw new Error('Invalid authorization code');
    }
    return pending.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    _resource?: URL,
  ): Promise<OAuthTokens> {
    const pending = pendingAuthorizations.get(authorizationCode);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingAuthorizations.delete(authorizationCode);
      throw new Error('Authorization code expired or invalid');
    }

    pendingAuthorizations.delete(authorizationCode);

    const accessToken = pending.apiToken;
    const refreshToken = generateId();
    refreshTokens.set(refreshToken, {
      apiToken: accessToken,
      clientId: client.client_id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: 'mcp',
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const record = refreshTokens.get(refreshToken);
    if (!record || record.expiresAt < Date.now() || record.clientId !== client.client_id) {
      refreshTokens.delete(refreshToken);
      throw new Error('invalid_grant');
    }

    const isValid = await validateApiToken(this.config.arxenaBaseUrl, record.apiToken);
    if (!isValid) {
      refreshTokens.delete(refreshToken);
      throw new Error('invalid_grant');
    }

    const nextRefreshToken = generateId();
    refreshTokens.delete(refreshToken);
    refreshTokens.set(nextRefreshToken, {
      apiToken: record.apiToken,
      clientId: client.client_id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000,
    });

    return {
      access_token: record.apiToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: nextRefreshToken,
      scope: 'mcp',
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const isValid = await validateApiToken(this.config.arxenaBaseUrl, token);
    if (!isValid) {
      throw new Error('Invalid access token');
    }

    return createAuthInfoFromToken(token, this.config.mcpPublicUrl);
  }

  createAuthorizationCode(input: {
    apiToken: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
  }): string {
    const code = generateId();
    pendingAuthorizations.set(code, {
      apiToken: input.apiToken,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    });
    return code;
  }

  getArxenaConfigFromToken(token: string) {
    return buildArxenaConfigFromToken(token, this.config.arxenaBaseUrl);
  }
}

export const hashConsentState = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
