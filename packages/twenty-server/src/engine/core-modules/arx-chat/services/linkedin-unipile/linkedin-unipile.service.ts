import type {
    LinkedinCheckpointData,
    LinkedinCookieAuth,
    LinkedinCredentials,
    LinkedinProfileData,
    LinkedinSignupResponse,
    UnipileLinkedinAccount,
} from 'twenty-shared';

import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';
import {
    buildUnipileV2HostedAuthLinkBody,
    buildUnipileV2LinkedinCookieAuthIntentBody,
    buildUnipileV2LinkedinCredentialsAuthIntentBody,
} from 'src/engine/core-modules/unipile-client/unipile-v2-auth-body.util';

type UnipileAuthResponse = {
  id?: string;
  account_id?: string;
  intent_id?: string;
  status?: string;
  profile_data?: LinkedinProfileData;
};

export class LinkedinUnipileService {
  private unipileClient: UnipileV2Client;

  constructor(baseUrl: string, accessToken: string) {
    this.unipileClient = new UnipileV2Client(baseUrl, accessToken);
  }

  /**
   * Connect LinkedIn account with username/password via POST /v2/auth/intent
   */
  async connectWithCredentials(credentials: LinkedinCredentials): Promise<LinkedinSignupResponse> {
    try {
      const response = (await this.unipileClient.startAuthIntent(
        buildUnipileV2LinkedinCredentialsAuthIntentBody({
          username: credentials.username,
          password: credentials.password,
        }),
      )) as UnipileAuthResponse;

      return this.toSignupResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Connect LinkedIn account with cookie/user-agent via POST /v2/auth/intent
   */
  async connectWithCookie(cookieAuth: LinkedinCookieAuth): Promise<LinkedinSignupResponse> {
    try {
      const response = (await this.unipileClient.startAuthIntent(
        buildUnipileV2LinkedinCookieAuthIntentBody({
          accessToken: cookieAuth.access_token,
          premiumToken: cookieAuth.premium_token,
          userAgent: cookieAuth.user_agent,
          ip: cookieAuth.ip,
          country: cookieAuth.country,
        }),
      )) as UnipileAuthResponse;

      return this.toSignupResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Create hosted authentication link via POST /v2/auth/link
   */
  async createHostedAuthLink(options: {
    expiresOn?: string;
    api_url?: string;
    success_redirect_url?: string;
    failure_redirect_url?: string;
    notify_url?: string;
  }): Promise<{ hosted_link: string }> {
    const data = await this.unipileClient.createHostedAuthLink(
      buildUnipileV2HostedAuthLinkBody({
        providers: ['linkedin'],
        expiresOn: options.expiresOn,
        successRedirectUrl: options.success_redirect_url,
        failureRedirectUrl: options.failure_redirect_url,
      }),
    );
    return { hosted_link: data.hosted_link ?? data.url ?? data.link ?? '' };
  }

  /**
   * Solve 2FA/OTP checkpoint via POST /v2/auth/checkpoint
   */
  async solveCheckpoint(checkpointData: LinkedinCheckpointData): Promise<LinkedinSignupResponse> {
    try {
      const response = (await this.unipileClient.solveCheckpoint({
        intent_id: checkpointData.account_id,
        code: checkpointData.code,
      })) as UnipileAuthResponse;

      return this.toSignupResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Get LinkedIn account details via GET /v2/accounts/:account_id
   */
  async getAccount(accountId: string): Promise<UnipileLinkedinAccount> {
    const item = await this.unipileClient.getAccount(accountId);
    return this.toLinkedinAccount(item);
  }

  /**
   * Get all LinkedIn accounts via GET /v2/accounts
   */
  async getAllAccounts(): Promise<UnipileLinkedinAccount[]> {
    const items = await this.unipileClient.listAccounts();

    return items
      .filter((item) => {
        const type = String(item.type ?? item.provider ?? '').toLowerCase();
        return type === 'linkedin';
      })
      .map((item) => this.toLinkedinAccount(item));
  }

  /**
   * Get own LinkedIn profile via GET /v2/:account_id/users/me
   */
  async getOwnProfile(accountId: string): Promise<LinkedinProfileData> {
    return this.unipileClient.getUser(accountId, 'me') as Promise<LinkedinProfileData>;
  }

  /**
   * Resync is removed in Unipile v2 (LinkedIn is on-demand).
   */
  async resyncAccount(_accountId: string): Promise<{ status: string }> {
    return { status: 'skipped' };
  }

  /**
   * Disconnect LinkedIn account via DELETE /v2/accounts/:account_id
   */
  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    try {
      await this.unipileClient.deleteAccount(accountId);
      return { success: true };
    } catch (error) {
      console.error('Failed to disconnect LinkedIn account:', error);
      return { success: false };
    }
  }

  private toSignupResponse(response: UnipileAuthResponse): LinkedinSignupResponse {
    return {
      success: true,
      data: {
        account_id: String(
          response.id || response.account_id || response.intent_id || '',
        ),
        provider: 'LINKEDIN',
        status: response.status || 'connected',
        profile: response.profile_data,
      },
    };
  }

  private toLinkedinAccount(item: Record<string, unknown>): UnipileLinkedinAccount {
    return {
      id: String(item.id ?? ''),
      username: String(item.name ?? item.username ?? 'Unknown'),
      name: String(item.name ?? 'Unknown'),
      type: typeof item.type === 'string' ? item.type : 'LINKEDIN',
      status: this.mapAccountStatus(item),
      created_at: typeof item.created_at === 'string' ? item.created_at : undefined,
      provider: 'LINKEDIN',
      connection_params: item.connection_params as UnipileLinkedinAccount['connection_params'],
      sources: Array.isArray(item.sources) ? item.sources : [],
      groups: Array.isArray(item.groups) ? item.groups : [],
    };
  }

  private mapAccountStatus(account: Record<string, unknown>): UnipileLinkedinAccount['status'] {
    const connectionParams =
      account.connection_params && typeof account.connection_params === 'object'
        ? (account.connection_params as Record<string, unknown>)
        : undefined;
    const im =
      connectionParams?.im && typeof connectionParams.im === 'object'
        ? (connectionParams.im as Record<string, unknown>)
        : undefined;
    const sources = Array.isArray(account.sources) ? account.sources : [];
    const firstSource =
      sources[0] && typeof sources[0] === 'object'
        ? (sources[0] as Record<string, unknown>)
        : undefined;

    const rawStatus =
      connectionParams?.status ??
      account.status ??
      im?.status ??
      firstSource?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (['active', 'ok', 'connected', 'ready', 'synced', 'running'].includes(status)) {
        return 'connected';
      }
      if (['credentials', 'failed', 'error', 'disconnected', 'revoked'].includes(status)) {
        return 'disconnected';
      }
      if (status === 'checkpoint_required') {
        return 'checkpoint_required';
      }
      if (status === 'pending' || status === 'syncing') {
        return 'pending';
      }
      return 'disconnected';
    }

    return account.id ? 'connected' : 'disconnected';
  }
}

let linkedinService: LinkedinUnipileService | null = null;

export const getLinkedinUnipileService = (baseUrl?: string, accessToken?: string): LinkedinUnipileService => {
  if (!linkedinService && baseUrl && accessToken) {
    linkedinService = new LinkedinUnipileService(baseUrl, accessToken);
  }

  if (!linkedinService) {
    throw new Error('LinkedIn Unipile service not initialized. Please provide baseUrl and accessToken.');
  }

  return linkedinService;
};

export const initializeLinkedinUnipileService = (baseUrl: string, accessToken: string): void => {
  linkedinService = new LinkedinUnipileService(baseUrl, accessToken);
};
