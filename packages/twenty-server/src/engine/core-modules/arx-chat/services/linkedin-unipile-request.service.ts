import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { type UnipileAccountOwnerProfile } from 'twenty-shared';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

type LinkedinUnipileAccountItem = Record<string, unknown> & {
  id?: string;
  name?: string;
  type?: string;
  created_at?: string;
  connection_params?: {
    im?: { publicIdentifier?: string; status?: string };
    status?: string;
  };
  status?: string;
  sources?: { status?: string }[];
  groups?: unknown[];
};

@Injectable()
export class LinkedinUnipileRequestService {
  private readonly logger = new Logger(LinkedinUnipileRequestService.name);

  private readonly unipileApiUrl = process.env.UNIPILE_API_URL;
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(
      `Unipile Access Token configured: ${!!this.unipileAccessToken}`,
    );
  }

  async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    options?: { returnStatus: true },
  ): Promise<unknown> {
    const url = `${this.unipileApiUrl}${endpoint}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      this.logger.log(`Making Unipile request to: ${url}`);
      this.logger.log(
        `Using API key: ${this.unipileAccessToken?.substring(0, 10) || ''}...`,
      );

      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.logger.error(
          `Unipile API error: ${response.status} ${response.statusText}`,
        );
        this.logger.error(
          `Unipile API error: Object:`,
          JSON.stringify(data, null, 2),
        );
        const message =
          (data as { detail?: string; message?: string }).detail ||
          (data as { message?: string }).message ||
          `Unipile API error: ${response.statusText}`;
        throw new HttpException(message, response.status);
      }

      if (options?.returnStatus) {
        return { status: response.status, data };
      }
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to make Unipile request:', error);
      throw new HttpException(
        'Failed to communicate with Unipile API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /** Fetch a single account by id; returns null on 404 (e.g. account disconnected) without logging ERROR. */
  async fetchAccountByIdIfExists(
    accountId: string,
  ): Promise<LinkedinUnipileAccountItem | null> {
    const url = `${this.unipileApiUrl}/api/v1/accounts/${accountId}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
    };
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (response.status === 404) {
        this.logger.warn(
          `Workspace linked account ${accountId} not found in Unipile (404); it may have been disconnected`,
        );
        return null;
      }
      if (!response.ok) {
        this.logger.error(
          `Unipile API error: ${response.status} ${response.statusText}`,
          data,
        );
        return null;
      }
      return data as LinkedinUnipileAccountItem;
    } catch (err) {
      this.logger.warn(
        `Could not fetch account ${accountId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  mapAccountStatus(
    account: LinkedinUnipileAccountItem,
  ): 'connected' | 'disconnected' | 'pending' | 'checkpoint_required' {
    const rawStatus =
      account?.connection_params?.status ??
      account?.status ??
      account?.connection_params?.im?.status ??
      account?.sources?.[0]?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (['active', 'ok', 'connected', 'ready', 'synced'].includes(status)) {
        return 'connected';
      }

      if (
        ['credentials', 'failed', 'error', 'disconnected', 'revoked'].includes(
          status,
        )
      ) {
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

    return account?.id ? 'connected' : 'disconnected';
  }

  /**
   * Normalizes a raw LinkedIn account payload from Unipile (list item or GET by id).
   */
  mapLinkedinApiItemToAccountRow(item: LinkedinUnipileAccountItem) {
    const publicIdentifier =
      item.connection_params?.im?.publicIdentifier?.trim() ?? '';
    const displayUsername =
      publicIdentifier !== '' ? publicIdentifier : item.name || 'Unknown';
    return {
      id: item.id,
      username: displayUsername,
      name: item.name || 'Unknown',
      type: item.type,
      status: this.mapAccountStatus(item),
      created_at: item.created_at,
      provider: 'LINKEDIN' as const,
      connection_params: item.connection_params,
      sources: item.sources || [],
      groups: item.groups || [],
    };
  }

  /**
   * All LinkedIn accounts from Unipile. Fetches the full account list and filters by
   * `type === 'LINKEDIN'` (the `?provider=linkedin` query can return an empty list on some DSNs).
   */
  async listAllLinkedinAccountsFromUnipileApi() {
    const response = (await this.makeUnipileRequest(
      '/api/v1/accounts',
    )) as { items?: LinkedinUnipileAccountItem[] };

    const accounts = (response.items || [])
      .filter((item) => String(item.type ?? '').toUpperCase() === 'LINKEDIN')
      .map((item) => this.mapLinkedinApiItemToAccountRow(item));

    this.logger.log(
      `Unipile LinkedIn API: ${accounts.length} account(s) (filtered from full list)`,
    );

    return { success: true as const, accounts };
  }

  async fetchLinkedinOwnerProfile(
    accountId: string,
  ): Promise<UnipileAccountOwnerProfile | null> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const response = (await this.makeUnipileRequest(
        `/api/v1/users/me?account_id=${encodeURIComponent(trimmed)}`,
      )) as UnipileAccountOwnerProfile;
      return response ?? null;
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinOwnerProfile failed for ${trimmed}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async getAllAccounts(workspace: Workspace): Promise<{
    success: boolean;
    accounts: LinkedinUnipileAccountItem[];
    message?: string;
  }> {
    try {
      const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(
        workspace.id,
      );
      const linkedinUrl = workspaceKeys.linkedin_url;
      const linkedinUnipileAccountId = workspaceKeys.linkedin_unipile_account_id;

      if (!linkedinUrl && !linkedinUnipileAccountId) {
        this.logger.warn(
          `No linkedin_url or linkedin_unipile_account_id for workspace ${workspace.id}, skipping Unipile accounts call`,
        );
        return {
          success: true,
          accounts: [],
          message: 'linkedin_url not configured for workspace',
        };
      }

      const response = (await this.makeUnipileRequest(
        '/api/v1/accounts?provider=linkedin',
      )) as { items?: LinkedinUnipileAccountItem[] };
      this.logger.log('Getting getAllAccounts response');

      this.logger.log(
        `Filtering LinkedIn accounts for workspace ${workspace.id} with linkedin_url: ${linkedinUrl ?? 'none'}, linkedin_unipile_account_id: ${linkedinUnipileAccountId ?? 'none'}`,
      );

      const allAccounts = (response.items || []).map((item) =>
        this.mapLinkedinApiItemToAccountRow(item),
      );

      const accounts = allAccounts.filter((account) => {
        if (linkedinUnipileAccountId && account.id === linkedinUnipileAccountId) {
          this.logger.log(
            `Account ${account.id} matches workspace linkedin_unipile_account_id`,
          );
          return true;
        }

        const accountPublicIdentifier =
          account.connection_params?.im?.publicIdentifier;
        if (!accountPublicIdentifier) {
          this.logger.warn(
            `Account ${account.id} has no publicIdentifier in connection_params`,
          );
          return false;
        }

        if (!linkedinUrl) return false;

        const matches =
          accountPublicIdentifier === linkedinUrl ||
          linkedinUrl.includes(accountPublicIdentifier) ||
          accountPublicIdentifier.includes(linkedinUrl);

        if (matches) {
          this.logger.log(
            `Account ${account.id} (${accountPublicIdentifier}) matches linkedin_url: ${linkedinUrl}`,
          );
        } else {
          this.logger.log(
            `Account ${account.id} (${accountPublicIdentifier}) does not match linkedin_url: ${linkedinUrl}`,
          );
        }

        return matches;
      });

      if (
        linkedinUnipileAccountId &&
        !accounts.some((a) => a.id === linkedinUnipileAccountId)
      ) {
        const single = await this.fetchAccountByIdIfExists(
          linkedinUnipileAccountId,
        );
        if (single) {
          const mapped = this.mapLinkedinApiItemToAccountRow(single);
          accounts.push(mapped);
          this.logger.log(
            `Included workspace linked account ${linkedinUnipileAccountId} from single-account fetch`,
          );
        }
      }

      this.logger.log(
        `Filtered ${accounts.length} LinkedIn accounts from ${allAccounts.length} total accounts`,
      );

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn accounts:', error);
      throw error;
    }
  }

  async disconnectAccountBestEffort(
    accountId: string,
    context: string,
  ): Promise<void> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return;
    }
    const url = `${this.unipileApiUrl}/api/v1/accounts/${trimmed}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
    };
    try {
      const response = await fetch(url, { method: 'DELETE', headers });
      if (response.ok || response.status === 404) {
        this.logger.log(
          `Unipile LinkedIn account ${trimmed} disconnected (${context}); status=${response.status}`,
        );
        return;
      }
      const data = await response.json().catch(() => ({}));
      this.logger.warn(
        `Best-effort LinkedIn Unipile disconnect failed (${context}): ${response.status}`,
        data,
      );
    } catch (err) {
      this.logger.warn(
        `Best-effort LinkedIn Unipile disconnect error (${context}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
