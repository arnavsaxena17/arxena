import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
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
      const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(
        workspace.id,
      );
      const whatsappPhoneNumber = workspaceKeys.whatsapp_web_phone_number;

      if (!whatsappPhoneNumber) {
        this.logger.warn(
          `No whatsapp_web_phone_number found for workspace ${workspace.id}, skipping Unipile accounts call`,
        );
        return {
          success: true,
          accounts: [],
          message: 'whatsapp_web_phone_number not configured for workspace',
        };
      }

      const response = (await this.makeUnipileRequest(
        '/api/v1/accounts?provider=whatsapp',
      )) as { items?: UnipileAccountItem[] };

      this.logger.log(
        `Filtering WhatsApp accounts for workspace ${workspace.id} with whatsapp_web_phone_number: ${whatsappPhoneNumber}`,
      );

      const allAccounts = (response.items || []).map((item) => ({
        id: item.id,
        username: item.name || item.phone_number || 'Unknown',
        name: item.name || 'Unknown',
        phone_number: item.phone_number,
        type: item.type,
        status: this.mapAccountStatus(item),
        created_at: item.created_at,
        provider: 'WHATSAPP',
        connection_params: item.connection_params,
        sources: item.sources || [],
        groups: item.groups || [],
      }));

      const accounts = allAccounts.filter((account) => {
        const accountPhoneNumber =
          account.connection_params?.im?.phone_number || account.phone_number;
        if (!accountPhoneNumber) {
          this.logger.warn(
            `Account ${account.id} has no phone_number in connection_params`,
          );
          return false;
        }

        const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
        const normalizedAccountPhone = normalizePhone(accountPhoneNumber);
        const normalizedWorkspacePhone = normalizePhone(whatsappPhoneNumber);

        const matches = normalizedAccountPhone === normalizedWorkspacePhone;
        this.logger.log(
          `normalised account number ${normalizedAccountPhone} and normalised workspace number ${normalizedWorkspacePhone}`,
        );
        if (matches) {
          this.logger.log(
            `Account ${account.id} (${accountPhoneNumber}) matches whatsapp_web_phone_number: ${whatsappPhoneNumber}`,
          );
        } else {
          this.logger.log(
            `Account ${account.id} (${accountPhoneNumber}) does not match whatsapp_web_phone_number: ${whatsappPhoneNumber}`,
          );
        }

        return matches;
      });

      this.logger.log(
        `Filtered ${accounts.length} WhatsApp accounts from ${allAccounts.length} total accounts`,
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
