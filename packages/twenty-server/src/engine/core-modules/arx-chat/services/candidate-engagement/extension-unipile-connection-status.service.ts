import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { type LinkedInSearchType } from 'twenty-shared';

import { LinkedinUnipileRequestService } from '../linkedin-unipile-request.service';
import { MemberLinkedinUnipileConnectionService } from '../member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from '../workspace-member-profile-unipile.service';

@Injectable()
export class ExtensionUnipileConnectionStatusService {
  private readonly logger = new Logger(
    ExtensionUnipileConnectionStatusService.name,
  );
  private static readonly CONNECTION_STATUS_CACHE_TTL_MS = 45_000;
  private readonly connectionStatusCache = new Map<
    string,
    {
      expiresAt: number;
      payload: {
        linkedinConnected: boolean;
        linkedinCookiesStored: boolean;
        linkedinCookiesLastSyncedAt: string | null;
        linkedinCookiesValidatedAt: string | null;
        whatsappConnected: boolean;
        connectLinkedinToUnipileAutomatically: boolean;
        linkedinUnipileOnDemand: boolean;
        linkedinUrl: string | null;
        workspaceMemberId: string | null;
        linkedinUnipileAccountId?: string | null;
        inferredSearchType?: LinkedInSearchType;
        salesNavigatorAvailable?: boolean;
        recruiterAvailable?: boolean;
      };
    }
  >();

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  async getConnectionStatusForCurrentUser(
    workspace : WorkspaceEntity,
    apiToken: string,
    workspaceMemberId: string | undefined,
  ): Promise<{
    linkedinConnected: boolean;
    linkedinCookiesStored: boolean;
    linkedinCookiesLastSyncedAt: string | null;
    linkedinCookiesValidatedAt: string | null;
    whatsappConnected: boolean;
    connectLinkedinToUnipileAutomatically: boolean;
    linkedinUnipileOnDemand: boolean;
    linkedinUrl: string | null;
    workspaceMemberId: string | null;
    linkedinUnipileAccountId?: string | null;
    inferredSearchType?: LinkedInSearchType;
    salesNavigatorAvailable?: boolean;
    recruiterAvailable?: boolean;
  }> {
    if (!workspaceMemberId) {
      this.logger.warn(
        'unipile-connection-status: missing workspaceMemberId on JWT',
      );
      return {
        linkedinConnected: false,
        linkedinCookiesStored: false,
        linkedinCookiesLastSyncedAt: null,
        linkedinCookiesValidatedAt: null,
        whatsappConnected: false,
        connectLinkedinToUnipileAutomatically: this.environmentService.get(
          'CONNECT_LINKEDIN_TO_UNIPILE_AUTOMATICALLY',
        ),
        linkedinUnipileOnDemand: this.environmentService.get(
          'LINKEDIN_UNIPILE_ON_DEMAND',
        ),
        linkedinUrl: null,
        workspaceMemberId: null,
      };
    }

    const cacheKey = `${workspace.id}:${workspaceMemberId}`;
    const cached = this.connectionStatusCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const payload = await this.buildConnectionStatusForCurrentUser(
      workspace,
      apiToken,
      workspaceMemberId,
    );
    this.connectionStatusCache.set(cacheKey, {
      payload,
      expiresAt:
        Date.now() +
        ExtensionUnipileConnectionStatusService.CONNECTION_STATUS_CACHE_TTL_MS,
    });
    return payload;
  }

  private async buildConnectionStatusForCurrentUser(
    workspace : WorkspaceEntity,
    apiToken: string,
    workspaceMemberId: string,
  ): Promise<{
    linkedinConnected: boolean;
    linkedinCookiesStored: boolean;
    linkedinCookiesLastSyncedAt: string | null;
    linkedinCookiesValidatedAt: string | null;
    whatsappConnected: boolean;
    connectLinkedinToUnipileAutomatically: boolean;
    linkedinUnipileOnDemand: boolean;
    linkedinUrl: string | null;
    workspaceMemberId: string | null;
    linkedinUnipileAccountId?: string | null;
    inferredSearchType?: LinkedInSearchType;
    salesNavigatorAvailable?: boolean;
    recruiterAvailable?: boolean;
  }> {
    let profile = null as Awaited<
      ReturnType<
        typeof this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields
      >
    >;

    try {
      profile =
        await this.memberLinkedinUnipileConnectionService.getValidatedWorkspaceMemberProfileFields(
          workspaceMemberId,
          apiToken,
        );
    } catch (err) {
      this.logger.warn(
        'Failed to load workspace member profile for extension unipile status',
        err,
      );
    }

    const linkedinConnected =
      await this.memberLinkedinUnipileConnectionService.isLinkedinUsableForProfile(
        profile,
      );

    if (!linkedinConnected && profile?.linkedinUnipileAccountId?.trim()) {
      await this.memberLinkedinUnipileConnectionService.cleanupUnusableStoredLinkedinAccountIfNeeded(
        workspaceMemberId,
        apiToken,
        profile.linkedinUnipileAccountId,
        'extension unipile connection status',
        workspace.id,
      );
      profile =
        await this.memberLinkedinUnipileConnectionService.getValidatedWorkspaceMemberProfileFields(
          workspaceMemberId,
          apiToken,
        );
    }

    const linkedinConnectedAfterCleanup =
      await this.memberLinkedinUnipileConnectionService.isLinkedinUsableForProfile(
        profile,
      );
    const whatsappConnected =
      await this.memberLinkedinUnipileConnectionService.isWhatsappConnectedForProfile(
        profile,
        workspace,
      );
    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        apiToken,
        workspaceMemberId,
      );

    this.logger.log(
      `unipile-connection-status member=${workspaceMemberId} linkedinConnected=${linkedinConnectedAfterCleanup} whatsappConnected=${whatsappConnected} ` +
        `storedLinkedinId=${profile?.linkedinUnipileAccountId ?? 'none'} storedWhatsappId=${profile?.whatsappUnipileAccountId ?? 'none'}`,
    );

    const linkedinUnipileAccountId = profile?.linkedinUnipileAccountId?.trim()
      ? profile.linkedinUnipileAccountId.trim()
      : null;
    let inferredSearchType: LinkedInSearchType | undefined;
    let salesNavigatorAvailable: boolean | undefined;
    let recruiterAvailable: boolean | undefined;

    if (linkedinConnectedAfterCleanup && linkedinUnipileAccountId) {
      const capabilities =
        await this.linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount(
          linkedinUnipileAccountId,
        );
      if (capabilities) {
        inferredSearchType = capabilities.inferredSearchType;
        salesNavigatorAvailable = capabilities.salesNavigatorAvailable;
        recruiterAvailable = capabilities.recruiterAvailable;
      }
    }

    return {
      linkedinConnected: linkedinConnectedAfterCleanup,
      linkedinCookiesStored: Boolean(storedCookies.linkedinLiAtToken),
      linkedinCookiesLastSyncedAt: storedCookies.linkedinCookiesLastSyncedAt,
      linkedinCookiesValidatedAt: storedCookies.linkedinCookiesValidatedAt,
      whatsappConnected,
      connectLinkedinToUnipileAutomatically: this.environmentService.get(
        'CONNECT_LINKEDIN_TO_UNIPILE_AUTOMATICALLY',
      ),
      linkedinUnipileOnDemand: this.environmentService.get(
        'LINKEDIN_UNIPILE_ON_DEMAND',
      ),
      linkedinUrl: profile?.linkedinUrl?.trim() ? profile.linkedinUrl.trim() : null,
      workspaceMemberId,
      linkedinUnipileAccountId,
      ...(inferredSearchType !== undefined ? { inferredSearchType } : {}),
      ...(salesNavigatorAvailable !== undefined
        ? { salesNavigatorAvailable }
        : {}),
      ...(recruiterAvailable !== undefined ? { recruiterAvailable } : {}),
    };
  }
}
