import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { UnipileV2Client } from 'src/engine/core-modules/unipile-client/unipile-v2.client';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

import {
  fetchUnipileAccountsListWithCache,
  invalidateUnipileAccountsListCache,
  shouldInvalidateUnipileAccountsListCache,
} from '../utils/unipile-accounts-list.cache';

type UnipileAccountItem = Record<string, unknown> & {
  id?: string;
  name?: string;
  phone_number?: string;
  type?: string;
  created_at?: string;
  connection_params?: {
    im?: { phone_number?: string; status?: string };
    status?: string;
  };
  sources?: { status?: string }[];
  groups?: unknown[];
};

@Injectable()
export class WhatsappUnipileRequestService {
  private readonly logger = new Logger(WhatsappUnipileRequestService.name);

  constructor(private readonly unipileV2Client: UnipileV2Client) {
    this.logger.log(`Unipile API URL: ${this.unipileV2Client.getBaseUrl()}`);
    this.logger.log(
      `Unipile Access Token configured: ${!!this.unipileV2Client.getApiKey()}`,
    );
  }

  async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    try {
      this.logger.log(`Making Unipile v2 request for: ${endpoint}`);
      const path = endpoint.split('?')[0] ?? endpoint;
      let data: unknown;
      if (method === 'GET' && path === '/v2/accounts') {
        data = { items: await this.unipileV2Client.listAccounts() };
      } else {
        data = await this.unipileV2Client.requestNormalized({
          path: endpoint,
          method,
          body,
        });
      }
      if (shouldInvalidateUnipileAccountsListCache(endpoint, method)) {
        invalidateUnipileAccountsListCache();
      }
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        if (error.getStatus() === HttpStatus.NOT_FOUND) {
          this.logger.warn(`Unipile API 404: ${error.message}`);
        }
        throw error;
      }

      this.logger.error('Failed to make Unipile request:', error);
      throw new HttpException(
        'Failed to communicate with Unipile API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  normalizePhoneDigits(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  /**
   * Check whether a phone number is registered on WhatsApp via Unipile
   * GET /v2/:account_id/users/{identifier}
   * See: https://developer.unipile.com/docs/users-overview
   * 200 = on WhatsApp; 404 = not on WhatsApp / invalid identifier.
   */
  async checkIfPhoneNumberOnWhatsApp(input: {
    phoneNumber: string;
    accountId: string;
  }): Promise<{
    phoneNumber: string;
    isOnWhatsApp: boolean;
    profile: {
      provider?: string;
      id?: string;
      is_business?: boolean;
      object?: string;
      [key: string]: unknown;
    } | null;
    accountId: string;
  }> {
    const phoneNumber = this.normalizePhoneDigits(input.phoneNumber);
    const accountId = input.accountId.trim();

    if (!phoneNumber) {
      throw new HttpException(
        'phoneNumber is required (E.164 digits, e.g. 33612345678)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!accountId) {
      throw new HttpException(
        'accountId is required (connected WhatsApp Unipile account)',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const profile = (await this.makeUnipileRequest(
        `/v2/${encodeURIComponent(accountId)}/users/${encodeURIComponent(phoneNumber)}`,
      )) as {
        provider?: string;
        id?: string;
        is_business?: boolean;
        object?: string;
        [key: string]: unknown;
      };

      return {
        phoneNumber,
        isOnWhatsApp: true,
        profile,
        accountId,
      };
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.NOT_FOUND
      ) {
        return {
          phoneNumber,
          isOnWhatsApp: false,
          profile: null,
          accountId,
        };
      }

      throw error;
    }
  }

  /** Fetch a single account by id; returns null on 404 (e.g. account disconnected) without logging ERROR. */
  async fetchAccountByIdIfExists(
    accountId: string,
  ): Promise<UnipileAccountItem | null> {
    try {
      return (await this.unipileV2Client.getAccount(
        accountId,
      )) as UnipileAccountItem;
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 404) {
        this.logger.warn(
          `Workspace linked WhatsApp account ${accountId} not found in Unipile (404); it may have been disconnected`,
        );
        return null;
      }
      this.logger.warn(
        `Could not fetch WhatsApp account ${accountId}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  mapAccountStatus(
    account: UnipileAccountItem,
  ): 'connected' | 'disconnected' | 'pending' | 'connecting' {
    const rawStatus =
      account?.connection_params?.status ??
      account?.status ??
      account?.connection_params?.im?.status ??
      account?.sources?.[0]?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (
        ['active', 'ok', 'connected', 'ready', 'synced', 'running'].includes(
          status,
        )
      ) {
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
        return 'pending';
      }

      if (
        status === 'connecting' ||
        status === 'pending' ||
        status === 'syncing'
      ) {
        return 'connecting';
      }
    }

    return account?.id ? 'connected' : 'disconnected';
  }

  /**
   * Normalizes a raw WhatsApp account payload from Unipile (list item or GET by id).
   */
  mapWhatsappApiItemToAccountRow(item: UnipileAccountItem) {
    const phoneFromConnection =
      item.connection_params?.im?.phone_number ?? item.phone_number;
    const displayPhone = phoneFromConnection ?? item.phone_number;
    return {
      id: item.id,
      username: item.name || displayPhone || 'Unknown',
      name: item.name || 'Unknown',
      phone_number: displayPhone,
      type: item.type,
      status: this.mapAccountStatus(item),
      created_at: item.created_at,
      provider: 'WHATSAPP' as const,
      connection_params: item.connection_params,
      sources: item.sources || [],
      groups: item.groups || [],
    };
  }

  /**
   * Raw Unipile account list (all providers). Cached process-wide because the list is
   * global to the Unipile DSN, not scoped to a workspace.
   */
  async fetchRawUnipileAccountsListCached(): Promise<{
    items?: UnipileAccountItem[];
  }> {
    return fetchUnipileAccountsListWithCache(async () => {
      this.logger.log(
        'Fetching Unipile account list from API for WhatsApp (cache miss or expired)',
      );
      return (await this.makeUnipileRequest('/v2/accounts')) as {
        items?: UnipileAccountItem[];
      };
    });
  }

  /**
   * Full WhatsApp account list from Unipile. Fetches all accounts and filters by type.
   */
  async getAllAccounts(workspace : WorkspaceEntity): Promise<{
    success: boolean;
    accounts: UnipileAccountItem[];
    message?: string;
  }> {
    try {
      const response = await this.fetchRawUnipileAccountsListCached();

      this.logger.log(
        `Listing WhatsApp accounts from Unipile for workspace ${workspace.id} (filtered from full list)`,
      );

      const accounts = (response.items || [])
        .filter((item) =>
          ['WHATSAPP', 'whatsapp'].includes(String(item.type ?? item.provider ?? '')),
        )
        .map((item) => this.mapWhatsappApiItemToAccountRow(item));

      this.logger.log(
        `Returning ${accounts.length} WhatsApp account(s) from Unipile for workspace ${workspace.id}`,
      );

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to get WhatsApp accounts:', error);
      throw error;
    }
  }

  /**
   * DELETE a Unipile WhatsApp account when a new connection supersedes the same phone identity.
   */
  async disconnectAccountBestEffort(
    accountId: string,
    context: string,
  ): Promise<void> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return;
    }
    try {
      await this.unipileV2Client.deleteAccount(trimmed);
      invalidateUnipileAccountsListCache();
      this.logger.log(
        `Unipile WhatsApp account ${trimmed} disconnected (${context})`,
      );
      return;
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 404) {
        invalidateUnipileAccountsListCache();
        return;
      }
      this.logger.warn(
        `Best-effort WhatsApp Unipile disconnect error (${context}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
