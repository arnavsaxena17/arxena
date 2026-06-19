import { Injectable, Logger, Optional } from '@nestjs/common';

import {
  type UnipileLinkedinAccount,
  type UnipileWhatsappAccount,
  type WorkspaceMemberProfileUnipileFields,
  findLinkedinUnipileAccountSameIdentityForProfile,
  hasMatchingConnectedWhatsappAccount,
  hasMatchingUsableLinkedinAccount,
  linkedinAccountIdentityMatchesWorkspaceMemberProfile,
  linkedinAccountUsableForWorkspaceMemberProfile,
  scoreLinkedinUnipileOwnerProfileCapability,
  whatsappAccountMatchesWorkspaceMemberProfile,
} from 'twenty-shared';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import { LinkedinUnipileAccountCleanupContext } from '../types/linkedin-unipile-account-cleanup.types';
import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { LinkedinUnipileTeardownSchedulerService } from './linkedin-unipile-teardown-scheduler.service';
import { WhatsappUnipileRequestService } from './whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

@Injectable()
export class MemberLinkedinUnipileConnectionService {
  private readonly logger = new Logger(MemberLinkedinUnipileConnectionService.name);
  private readonly connectLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly whatsappUnipileRequestService: WhatsappUnipileRequestService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    @Optional()
    private readonly linkedinUnipileTeardownSchedulerService?: LinkedinUnipileTeardownSchedulerService,
  ) {}

  /**
   * DELETE the Unipile LinkedIn account, drop metadata.unipile_accounts mapping, and
   * optionally clear linkedinUnipileAccountId on the workspace member profile.
   */
  async disconnectMemberLinkedinUnipileAccount(args: {
    accountId: string;
    context: string;
    workspaceMemberId?: string | null;
    workspaceId?: string | null;
    authToken?: string | null;
    forceClearProfile?: boolean;
  }): Promise<void> {
    const trimmedAccountId = args.accountId.trim();
    if (!trimmedAccountId) {
      return;
    }

    const workspaceMemberId = args.workspaceMemberId?.trim() ?? '';
    const workspaceId = args.workspaceId?.trim() ?? '';
    const authToken = args.authToken?.trim() ?? '';

    if (workspaceMemberId) {
      await this.linkedinUnipileTeardownSchedulerService?.cancelPendingDisconnect(
        workspaceMemberId,
      );
    }

    this.logger.log(
      `Disconnecting LinkedIn Unipile account accountId=${trimmedAccountId} context=${args.context} workspaceMemberId=${workspaceMemberId || 'unknown'}`,
    );

    await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
      trimmedAccountId,
      args.context,
    );

    if (workspaceMemberId) {
      try {
        await this.workspaceQueryService.deleteUnipileMemberAccountMapping(
          workspaceMemberId,
          'LINKEDIN',
        );
      } catch (error) {
        this.logger.warn(
          `Failed to remove LinkedIn Unipile pool mapping for workspaceMemberId=${workspaceMemberId}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (!workspaceMemberId || !authToken) {
      return;
    }

    if (args.forceClearProfile) {
      await this.workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        authToken,
        'linkedin',
      );
      return;
    }

    if (!workspaceId) {
      return;
    }

    const storedId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        workspaceId,
        authToken,
        'linkedin',
      );
    if (storedId?.trim() === trimmedAccountId) {
      await this.workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        authToken,
        'linkedin',
      );
    }
  }

  async withMemberLinkedinConnectLock<T>(
    workspaceMemberId: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const trimmedMemberId = workspaceMemberId.trim();
    const previous = this.connectLocks.get(trimmedMemberId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => gate);
    this.connectLocks.set(trimmedMemberId, chain);

    try {
      await previous;
      return await run();
    } finally {
      release();
      if (this.connectLocks.get(trimmedMemberId) === chain) {
        this.connectLocks.delete(trimmedMemberId);
      }
    }
  }

  /**
   * When the profile stores a LinkedIn Unipile account id that is missing (404) or
   * disconnected at Unipile, DELETE the account and clear linkedinUnipileAccountId.
   */
  async cleanupUnusableStoredLinkedinAccountIfNeeded(
    workspaceMemberId: string,
    authToken: string,
    storedAccountId: string | null | undefined,
    context: string,
    workspaceId?: string | null,
  ): Promise<boolean> {
    const trimmed = storedAccountId?.trim();
    if (!trimmed) {
      return false;
    }

    const account =
      await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
        trimmed,
      );

    if (!account) {
      this.logger.warn(
        `Clearing missing LinkedIn Unipile account id=${trimmed} from workspace member profile workspaceMemberId=${workspaceMemberId} context=${context}`,
      );
      await this.workspaceMemberProfileUnipileService.clearWorkspaceMemberUnipileAccountId(
        workspaceMemberId,
        authToken,
        'linkedin',
      );
      return true;
    }

    const mappedStatus =
      this.linkedinUnipileRequestService.mapAccountStatus(account);
    if (mappedStatus !== 'disconnected') {
      return false;
    }

    this.logger.warn(
      `Removing disconnected LinkedIn Unipile account id=${trimmed} workspaceMemberId=${workspaceMemberId} context=${context}`,
    );
    await this.disconnectMemberLinkedinUnipileAccount({
      accountId: trimmed,
      context,
      workspaceMemberId,
      workspaceId,
      authToken,
      forceClearProfile: true,
    });
    return true;
  }

  async cleanupStoredLinkedinAccountAfterDisconnectedApiError(
    args: LinkedinUnipileAccountCleanupContext,
  ): Promise<void> {
    const accountId = args.accountId.trim();
    const workspaceMemberId = args.workspaceMemberId.trim();
    const authToken = args.authToken.trim();

    if (!accountId || !workspaceMemberId || !authToken) {
      return;
    }

    this.logger.warn(
      `Cleaning up LinkedIn Unipile account after disconnected_account API error accountId=${accountId} workspaceMemberId=${workspaceMemberId} context=${args.context}`,
    );

    await this.disconnectMemberLinkedinUnipileAccount({
      accountId,
      context: args.context,
      workspaceMemberId,
      workspaceId: args.workspaceId,
      authToken,
      forceClearProfile: true,
    });
  }

  async clearStaleStoredLinkedinAccountIdIfNeeded(
    workspaceMemberId: string,
    authToken: string,
    storedAccountId: string | null | undefined,
    workspaceId?: string | null,
  ): Promise<boolean> {
    return this.cleanupUnusableStoredLinkedinAccountIfNeeded(
      workspaceMemberId,
      authToken,
      storedAccountId,
      'stale stored LinkedIn Unipile account id',
      workspaceId,
    );
  }

  async getValidatedWorkspaceMemberProfileFields(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileUnipileFields | null> {
    const profile = await this.getWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );
    if (!profile) {
      return null;
    }

    const cleared = await this.clearStaleStoredLinkedinAccountIdIfNeeded(
      workspaceMemberId,
      authToken,
      profile.linkedinUnipileAccountId,
    );
    if (!cleared) {
      return profile;
    }

    return {
      ...profile,
      linkedinUnipileAccountId: null,
    };
  }

  async findLinkedinAccountSameIdentityForMember(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<UnipileLinkedinAccount | undefined> {
    const profile = await this.getValidatedWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );
    if (!profile) {
      return undefined;
    }

    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();

    return findLinkedinUnipileAccountSameIdentityForProfile(
      accounts as unknown as UnipileLinkedinAccount[],
      profile,
    );
  }

  async findUsableLinkedinAccountForMember(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<UnipileLinkedinAccount | undefined> {
    const profile = await this.getValidatedWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );
    if (!profile) {
      return undefined;
    }

    const accounts = await this.listLinkedinAccountsForMemberStatus(profile);
    for (const account of accounts) {
      if (linkedinAccountUsableForWorkspaceMemberProfile(profile, account)) {
        return account;
      }
    }

    return undefined;
  }

  /**
   * After POST /accounts (or any new connection), prune duplicate rows for the same LinkedIn
   * identity and persist the surviving Unipile account id on the workspace member profile.
   */
  async syncMemberLinkedinAccountAfterConnect(
    workspaceMemberId: string,
    authToken: string,
    preferredAccountId: string,
  ): Promise<string> {
    const trimmedPreferred = preferredAccountId.trim();
    if (!trimmedPreferred) {
      return preferredAccountId;
    }

    const profile = await this.getWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );
    if (!profile) {
      return trimmedPreferred;
    }

    const keepId = await this.pruneDuplicateLinkedinAccountsForProfile(
      profile,
      trimmedPreferred,
    );
    const finalId = keepId?.trim() || trimmedPreferred;

    if (finalId !== profile.linkedinUnipileAccountId?.trim()) {
      const accountPayload =
        await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
          finalId,
        );
      if (accountPayload) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          workspaceMemberId,
          authToken,
          'linkedin',
          finalId,
          accountPayload,
        );
      } else {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          authToken,
          'linkedin',
          finalId,
        );
      }
    }

    return finalId;
  }

  async getWorkspaceMemberProfileFields(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<WorkspaceMemberProfileUnipileFields | null> {
    return this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
      workspaceMemberId,
      authToken,
    );
  }

  async listLinkedinAccountsForMemberStatus(
    profile: WorkspaceMemberProfileUnipileFields | null,
  ): Promise<UnipileLinkedinAccount[]> {
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();

    const rows = accounts as unknown as UnipileLinkedinAccount[];
    const storedId = profile?.linkedinUnipileAccountId?.trim();
    if (!storedId || rows.some((acc) => acc.id === storedId)) {
      return rows;
    }

    const single =
      await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(storedId);
    if (!single) {
      // Stale id: caller should clear via getValidatedWorkspaceMemberProfileFields.
      return rows;
    }

    const mapped =
      this.linkedinUnipileRequestService.mapLinkedinApiItemToAccountRow(single);
    return [...rows, mapped as unknown as UnipileLinkedinAccount];
  }

  async isMemberLinkedinUsable(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<boolean> {
    const profile = await this.getValidatedWorkspaceMemberProfileFields(
      workspaceMemberId,
      authToken,
    );
    return this.isLinkedinUsableForProfile(profile);
  }

  async isLinkedinUsableForProfile(
    profile: WorkspaceMemberProfileUnipileFields | null,
  ): Promise<boolean> {
    if (!profile) {
      return false;
    }

    const storedId = profile.linkedinUnipileAccountId?.trim();
    if (storedId) {
      const account =
        await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
          storedId,
        );
      if (account) {
        const mapped =
          this.linkedinUnipileRequestService.mapLinkedinApiItemToAccountRow(
            account,
          );
        if (
          linkedinAccountUsableForWorkspaceMemberProfile(
            profile,
            mapped as unknown as UnipileLinkedinAccount,
          )
        ) {
          return true;
        }
      }
    }

    const accounts = await this.listLinkedinAccountsForMemberStatus(profile);
    return hasMatchingUsableLinkedinAccount(accounts, profile);
  }

  private mapWhatsappAccountRow(
    item: Record<string, unknown> & {
      id?: string;
      name?: string;
      phone_number?: string;
      connection_params?: { im?: { phone_number?: string } };
    },
  ): UnipileWhatsappAccount {
    const phoneFromConnection = item.connection_params?.im?.phone_number;
    const displayPhone = phoneFromConnection ?? item.phone_number;
    return {
      id: item.id ?? '',
      username: item.name || displayPhone || 'Unknown',
      name: item.name || 'Unknown',
      phone_number: displayPhone ?? null,
      type: 'WHATSAPP',
      status: this.whatsappUnipileRequestService.mapAccountStatus(item),
      provider: 'WHATSAPP',
      connection_params: item.connection_params,
      sources: [],
      groups: [],
    } as UnipileWhatsappAccount;
  }

  async listWhatsappAccountsForMemberStatus(
    profile: WorkspaceMemberProfileUnipileFields | null,
    workspace: Workspace,
  ): Promise<UnipileWhatsappAccount[]> {
    const { accounts } =
      await this.whatsappUnipileRequestService.getAllAccounts(workspace);
    const rows = accounts.map((item) =>
      this.mapWhatsappAccountRow(item as Parameters<typeof this.mapWhatsappAccountRow>[0]),
    );
    const storedId = profile?.whatsappUnipileAccountId?.trim();
    if (!storedId || rows.some((acc) => acc.id === storedId)) {
      return rows;
    }
    const single =
      await this.whatsappUnipileRequestService.fetchAccountByIdIfExists(
        storedId,
      );
    if (!single) {
      return rows;
    }
    return [
      ...rows,
      this.mapWhatsappAccountRow(
        single as Parameters<typeof this.mapWhatsappAccountRow>[0],
      ),
    ];
  }

  async isWhatsappConnectedForProfile(
    profile: WorkspaceMemberProfileUnipileFields | null,
    workspace: Workspace,
  ): Promise<boolean> {
    if (!profile) {
      return false;
    }

    const storedId = profile.whatsappUnipileAccountId?.trim();
    if (storedId) {
      const account =
        await this.whatsappUnipileRequestService.fetchAccountByIdIfExists(
          storedId,
        );
      if (account) {
        const waRow = this.mapWhatsappAccountRow(
          account as Parameters<typeof this.mapWhatsappAccountRow>[0],
        );
        if (whatsappAccountMatchesWorkspaceMemberProfile(profile, waRow)) {
          return true;
        }
      }
    }

    const accounts = await this.listWhatsappAccountsForMemberStatus(
      profile,
      workspace,
    );
    return hasMatchingConnectedWhatsappAccount(accounts, profile);
  }

  /**
   * When multiple Unipile rows share the same LinkedIn identity, keep the one with the best
   * Sales Navigator / Recruiter capability (from `GET /users/me`) and disconnect the rest.
   */
  async pruneDuplicateLinkedinAccountsForProfile(
    profile: WorkspaceMemberProfileUnipileFields,
    preferredAccountId?: string | null,
  ): Promise<string | null> {
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
    const allRows = accounts as unknown as UnipileLinkedinAccount[];

    const matching = allRows.filter((acc) =>
      linkedinAccountIdentityMatchesWorkspaceMemberProfile(profile, acc),
    );

    if (matching.length === 0) {
      return preferredAccountId?.trim() ? preferredAccountId.trim() : null;
    }

    if (matching.length === 1) {
      return matching[0]?.id ?? null;
    }

    const scored: Array<{ id: string; score: number }> = [];
    for (const acc of matching) {
      const ownerProfile =
        await this.linkedinUnipileRequestService.fetchLinkedinOwnerProfile(acc.id);
      scored.push({
        id: acc.id,
        score: scoreLinkedinUnipileOwnerProfileCapability(
          ownerProfile ?? { sales_navigator: null, recruiter: null },
        ),
      });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const storedId = profile.linkedinUnipileAccountId?.trim();
      if (storedId) {
        if (a.id === storedId) {
          return -1;
        }
        if (b.id === storedId) {
          return 1;
        }
      }
      if (preferredAccountId && a.id === preferredAccountId) {
        return -1;
      }
      if (preferredAccountId && b.id === preferredAccountId) {
        return 1;
      }
      return 0;
    });

    const keepId = scored[0]?.id;
    if (!keepId) {
      return preferredAccountId?.trim() ? preferredAccountId.trim() : null;
    }

    for (const entry of scored.slice(1)) {
      this.logger.log(
        `Disconnecting duplicate LinkedIn Unipile account for same member identity: accountId=${entry.id} keptAccountId=${keepId}`,
      );
      await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
        entry.id,
        'duplicate LinkedIn Unipile account for same member identity',
      );
    }

    this.logger.log(
      `Pruned duplicate LinkedIn Unipile accounts; kept=${keepId} removed=${scored
        .slice(1)
        .map((s) => s.id)
        .join(',')}`,
    );

    return keepId;
  }
}
