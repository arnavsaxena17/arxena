import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import {
    findLinkedinUnipileAccountBlockingNewConnectionForProfile,
    findWhatsappUnipileAccountBlockingNewConnectionForProfile,
    shouldBlockNewUnipileConnectionForStatus,
    type UnipileLinkedinAccount,
    type UnipileWhatsappAccount,
} from 'twenty-shared';

import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { WhatsappUnipileRequestService } from './whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

export type UnipileAccountType = 'LINKEDIN' | 'WHATSAPP';

/** Unipile account IDs that should never be disconnected by inactivity cron (e.g. testing accounts). */
const DISCONNECT_EXCLUDED_ACCOUNT_IDS = new Set([
  '0scX22z-SkuwEQweVlO3Yw',
  'exzavIWrQ_aB4Y2-dwRn-Q',
  ...(process.env.UNIPILE_DISCONNECT_EXCLUDED_ACCOUNT_IDS?.split(',').map((id) => id.trim()).filter(Boolean) ?? []),
]);

/**
 * Automatic Unipile teardown (WebSocket last-tab + LinkedIn inactivity cron) is opt-in.
 * Default off so linked WhatsApp/LinkedIn accounts are not deleted on tab close or cron.
 */
const isUnipileAutomaticMemberDisconnectEnabled = (): boolean => {
  const v = process.env.UNIPILE_MEMBER_AUTO_DISCONNECT?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
};

export type EnsureAccountResult =
  | { accountId: string }
  | { redirectUrl: string }
  | { status: 'pool_full'; slotsUsed: number; maxSlots: number };

@Injectable()
export class UnipileAccountPoolService {
  private readonly logger = new Logger(UnipileAccountPoolService.name);
  private readonly unipileApiUrl = process.env.UNIPILE_API_URL || '';
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN || '';
  private readonly maxPoolSize = parseInt(
    process.env.UNIPILE_ORGCHART_POOL_SIZE || '5',
    10,
  );

  constructor(
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly whatsappUnipileRequestService: WhatsappUnipileRequestService,
  ) {}

  async getWorkspaceIdByAccountId(accountId: string): Promise<string | null> {
    if (!accountId?.trim()) {
      return null;
    }

    const rows = await this.metadataDataSource.query(
      `SELECT workspace_id FROM metadata.unipile_accounts WHERE account_id = $1 LIMIT 1`,
      [accountId],
    );

    return rows?.[0]?.workspace_id ?? null;
  }

  /**
   * Get or create Unipile account for org-chart flow.
   * Returns accountId if connected, redirectUrl if need auth, or pool_full status.
   */
  async getOrCreateUnipileAccount(
    workspaceMemberId: string,
    workspaceId: string,
    authToken: string,
    accountType: UnipileAccountType,
    options?: {
      successRedirectUrl?: string;
      failureRedirectUrl?: string;
    },
  ): Promise<EnsureAccountResult> {
    const type = accountType === 'LINKEDIN' ? 'linkedin' : 'whatsapp';
    const workspace = { id: workspaceId } as Workspace;

    /** Hints for identity matching; connection state always comes from Unipile API responses below. */
    const profileFields =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
        workspaceMemberId,
        authToken,
      );

    const storedAccountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        workspaceId,
        authToken,
        type,
      );

    if (storedAccountId && String(storedAccountId).trim()) {
      const trimmed = String(storedAccountId).trim();
      if (accountType === 'LINKEDIN') {
        const raw =
          await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
            trimmed,
          );
        if (raw) {
          const status =
            this.linkedinUnipileRequestService.mapAccountStatus(raw);
          if (shouldBlockNewUnipileConnectionForStatus(status)) {
            await this.touchLastActive(workspaceMemberId, accountType);
            return { accountId: trimmed };
          }
        }
      } else {
        const raw =
          await this.whatsappUnipileRequestService.fetchAccountByIdIfExists(
            trimmed,
          );
        if (raw) {
          const status =
            this.whatsappUnipileRequestService.mapAccountStatus(raw);
          if (shouldBlockNewUnipileConnectionForStatus(status)) {
            await this.touchLastActive(workspaceMemberId, accountType);
            return { accountId: trimmed };
          }
        }
      }
    }

    if (accountType === 'LINKEDIN') {
      const { accounts } =
        await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
      const blocking =
        findLinkedinUnipileAccountBlockingNewConnectionForProfile(
          accounts as UnipileLinkedinAccount[],
          profileFields,
        );
      if (blocking?.id) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          blocking.id,
          blocking,
        );
        await this.touchLastActive(workspaceMemberId, accountType);
        return { accountId: blocking.id };
      }
    } else {
      const { accounts } =
        await this.whatsappUnipileRequestService.getAllAccounts(workspace);
      const blocking =
        findWhatsappUnipileAccountBlockingNewConnectionForProfile(
          accounts as unknown as UnipileWhatsappAccount[],
          profileFields,
        );
      if (blocking?.id) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'whatsapp',
          blocking.id,
          blocking,
        );
        await this.touchLastActive(workspaceMemberId, accountType);
        return { accountId: blocking.id };
      }
    }

    const keepConnected =
      await this.workspaceMemberProfileUnipileService.getKeepLinkedinConnected(
        workspaceMemberId,
        authToken,
      );

    if (keepConnected) {
      return { redirectUrl: await this.createHostedAuthUrl(workspaceMemberId, workspaceId, accountType, options) };
    }

    const poolStatus = await this.getPoolStatus();
    if (poolStatus.slotsAvailable <= 0) {
      this.logger.log(
        `Unipile pool: ${poolStatus.slotsUsed}/${this.maxPoolSize} slots used`,
      );
      return {
        status: 'pool_full',
        slotsUsed: poolStatus.slotsUsed,
        maxSlots: this.maxPoolSize,
      };
    }

    return {
      redirectUrl: await this.createHostedAuthUrl(workspaceMemberId, workspaceId, accountType, options),
    };
  }

  async getPoolStatus(): Promise<{
    slotsUsed: number;
    maxSlots: number;
    slotsAvailable: number;
  }> {
    const result = await this.metadataDataSource.query(
      `SELECT COUNT(*)::int as count FROM metadata.unipile_accounts WHERE account_type = $1`,
      ['LINKEDIN'],
    );
    const slotsUsed = result?.[0]?.count ?? 0;
    const slotsAvailable = Math.max(0, this.maxPoolSize - slotsUsed);
    return {
      slotsUsed,
      maxSlots: this.maxPoolSize,
      slotsAvailable,
    };
  }

  /**
   * Disconnect Unipile account for member (tab close, inactivity cron).
   * No-op unless UNIPILE_MEMBER_AUTO_DISCONNECT is true (see module-level note).
   */
  async disconnectForMember(
    workspaceMemberId: string,
    accountType?: UnipileAccountType,
  ): Promise<void> {
    if (!isUnipileAutomaticMemberDisconnectEnabled()) {
      return;
    }

    const rows = accountType
      ? await this.metadataDataSource.query(
          `SELECT account_id, workspace_id, account_type FROM metadata.unipile_accounts 
           WHERE workspace_member_id = $1 AND account_type = $2`,
          [workspaceMemberId, accountType],
        )
      : await this.metadataDataSource.query(
          `SELECT account_id, workspace_id, account_type FROM metadata.unipile_accounts 
           WHERE workspace_member_id = $1`,
          [workspaceMemberId],
        );

    if (!rows?.length) {
      this.logger.debug(
        `Unipile pool: no account for member ${workspaceMemberId}, skip disconnect`,
      );
      return;
    }

    for (const row of rows) {
      const { account_id, workspace_id, account_type } = row;
      try {
        await this.deleteUnipileAccount(account_id);
      } catch (err) {
        this.logger.warn(
          `Failed to DELETE Unipile account ${account_id}:`,
          err instanceof Error ? err.message : err,
        );
      }

      await this.metadataDataSource.query(
        `DELETE FROM metadata.unipile_accounts WHERE workspace_member_id = $1 AND account_type = $2`,
        [workspaceMemberId, account_type],
      );

      await this.clearWorkspaceMemberProfileUnipile(
        workspaceMemberId,
        workspace_id,
        account_type === 'LINKEDIN' ? 'linkedin' : 'whatsapp',
      );
    }

    this.logger.log(
      `Disconnected Unipile account(s) for workspace member ${workspaceMemberId}`,
    );
  }

  /**
   * Upsert pool record (called from webhook on CREATION_SUCCESS).
   */
  async upsertPoolRecord(
    workspaceMemberId: string,
    workspaceId: string,
    accountId: string,
    accountType: UnipileAccountType = 'LINKEDIN',
  ): Promise<void> {
    await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
      workspaceMemberId,
      workspaceId,
      accountId,
      accountType,
    );
  }

  /**
   * Disconnect pool accounts that have been inactive beyond threshold.
   * Only disconnects LINKEDIN accounts (org-chart pool). WhatsApp accounts are never
   * disconnected by this cron - they are for engagement/messaging.
   */
  async disconnectInactiveAccounts(): Promise<number> {
    if (!isUnipileAutomaticMemberDisconnectEnabled()) {
      return 0;
    }

    const thresholdMinutes = parseInt(
      process.env.UNIPILE_INACTIVITY_DISCONNECT_MINUTES || '30',
      10,
    );
    const rows = await this.metadataDataSource.query(
      `SELECT workspace_member_id, account_id, workspace_id, account_type 
       FROM metadata.unipile_accounts 
       WHERE account_type = 'LINKEDIN'
         AND last_active < NOW() - INTERVAL '1 minute' * $1`,
      [thresholdMinutes],
    );
    const rowsToDisconnect = (rows ?? []).filter(
      (row: { account_id: string }) => !DISCONNECT_EXCLUDED_ACCOUNT_IDS.has(row.account_id),
    );
    let disconnected = 0;
    for (const row of rowsToDisconnect) {
      try {
        await this.disconnectForMember(row.workspace_member_id, row.account_type);
        disconnected++;
      } catch (err) {
        this.logger.warn(
          `Failed to disconnect inactive account for ${row.workspace_member_id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    if (disconnected > 0) {
      this.logger.log(`Disconnected ${disconnected} inactive Unipile pool account(s)`);
    }
    return disconnected;
  }

  /**
   * Touch last_active for pool participant.
   */
  async touchLastActive(
    workspaceMemberId: string,
    accountType: UnipileAccountType = 'LINKEDIN',
  ): Promise<void> {
    await this.metadataDataSource.query(
      `UPDATE metadata.unipile_accounts SET last_active = NOW() 
       WHERE workspace_member_id = $1 AND account_type = $2`,
      [workspaceMemberId, accountType],
    );
  }

  private async createHostedAuthUrl(
    workspaceMemberId: string,
    workspaceId: string,
    accountType: UnipileAccountType,
    options?: {
      successRedirectUrl?: string;
      failureRedirectUrl?: string;
    },
  ): Promise<string> {
    const notifyUrl =
      `${process.env.SERVER_URL}/linkedin-unipile/webhook/account-connected`;
    const requestBody = {
      type: 'create',
      providers: accountType === 'LINKEDIN' ? ['LINKEDIN'] : ['WHATSAPP'],
      api_url: this.unipileApiUrl,
      expiresOn: new Date(
        Date.now() + 2 * 60 * 60 * 1000,
      ).toISOString(),
      success_redirect_url: options?.successRedirectUrl,
      failure_redirect_url: options?.failureRedirectUrl,
      notify_url: notifyUrl,
      name: `${workspaceMemberId}|${workspaceId}`,
    };

    const response = await fetch(`${this.unipileApiUrl}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-API-KEY': this.unipileAccessToken || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.error('Unipile hosted auth error:', data);
      throw new Error(data.detail || data.message || 'Failed to create hosted auth link');
    }

    return data.url || '';
  }

  private async deleteUnipileAccount(accountId: string): Promise<void> {
    const url = `${this.unipileApiUrl}/api/v1/accounts/${accountId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        'X-API-KEY': this.unipileAccessToken || '',
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || data.message || `DELETE failed: ${response.status}`);
    }
  }

  private async clearWorkspaceMemberProfileUnipile(
    workspaceMemberId: string,
    workspaceId: string,
    type: 'linkedin' | 'whatsapp',
  ): Promise<void> {
    const fieldName =
      type === 'linkedin' ? 'linkedinUnipileAccountId' : 'whatsappUnipileAccountId';
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
    const profileTable =
      await this.workspaceQueryService.resolveWorkspaceMemberProfileTableName(
        schema,
      );

    if (!profileTable) {
      return;
    }

    try {
      await this.workspaceQueryService.executeRawQuery(
        `UPDATE ${schema}."${profileTable}" SET "${fieldName}" = NULL WHERE "workspaceMemberId" = $1`,
        [workspaceMemberId],
        workspaceId,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to clear ${fieldName} for workspace member ${workspaceMemberId}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
