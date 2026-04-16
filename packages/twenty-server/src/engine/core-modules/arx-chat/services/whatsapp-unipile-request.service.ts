import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

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

  private readonly unipileApiUrl = process.env.UNIPILE_API_URL;
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN;

  constructor() {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(
      `Unipile Access Token configured: ${!!this.unipileAccessToken}`,
    );
  }

  async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
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

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        if (response.status === HttpStatus.NOT_FOUND) {
          this.logger.warn(`Unipile API 404: ${response.statusText}`, errorData);
        } else {
          this.logger.error(
            `Unipile API error: ${response.status} ${response.statusText}`,
            errorData,
          );
        }

        throw new HttpException(
          errorData.message || `Unipile API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
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
  ): Promise<UnipileAccountItem | null> {
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
          `Workspace linked WhatsApp account ${accountId} not found in Unipile (404); it may have been disconnected`,
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
      return data as UnipileAccountItem;
    } catch (err) {
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

  async getAllAccounts(workspace: Workspace): Promise<{
    success: boolean;
    accounts: UnipileAccountItem[];
    message?: string;
  }> {
    try {
      const response = (await this.makeUnipileRequest(
        '/api/v1/accounts?provider=whatsapp',
      )) as { items?: UnipileAccountItem[] };

      this.logger.log(
        `Listing WhatsApp accounts from Unipile for workspace ${workspace.id} (member-profile matching is applied in the app)`,
      );

      const accounts = (response.items || []).map((item) => {
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
          provider: 'WHATSAPP',
          connection_params: item.connection_params,
          sources: item.sources || [],
          groups: item.groups || [],
        };
      });

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
}
