import { Injectable, Logger } from '@nestjs/common';

import {
  type UnipileLinkedinAccount,
  type UnipileWhatsappAccount,
  type WorkspaceMemberProfileUnipileFields,
  hasMatchingConnectedWhatsappAccount,
  hasMatchingUsableLinkedinAccount,
  linkedinAccountIdentityMatchesWorkspaceMemberProfile,
  linkedinAccountUsableForWorkspaceMemberProfile,
  scoreLinkedinUnipileOwnerProfileCapability,
  whatsappAccountMatchesWorkspaceMemberProfile,
} from 'twenty-shared';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { WhatsappUnipileRequestService } from './whatsapp-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

@Injectable()
export class MemberLinkedinUnipileConnectionService {
  private readonly logger = new Logger(MemberLinkedinUnipileConnectionService.name);

  constructor(
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly whatsappUnipileRequestService: WhatsappUnipileRequestService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {}

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
    const profile = await this.getWorkspaceMemberProfileFields(
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
