import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
    findLinkedinUnipileAccountSameIdentityForProfile,
    isUnipileConnectedStatus,
    shouldBlockNewUnipileConnectionForStatus,
    type UnipileLinkedinAccount
} from 'twenty-shared';

import {
    type LinkedinUnipileMemberAccountResolution,
    type LinkedinUnipileMemberAccountStatus,
    type ResolveMemberLinkedinUnipileAccountArgs,
} from '../types/linkedin-unipile-member-account-resolution.types';
import { buildUnipileLinkedinCookieConnectBody } from '../utils/build-unipile-linkedin-cookie-connect-body.util';
import { isUnipileInvalidLinkedinCookieCredentialsError } from '../utils/is-unipile-invalid-linkedin-cookie-credentials-error.util';
import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

type UnipileConnectHttpResult = {
  status?: number;
  data?: {
    id?: string;
    account_id?: string;
    object?: string;
  };
};

@Injectable()
export class LinkedinUnipileMemberAccountResolverService {
  private readonly logger = new Logger(
    LinkedinUnipileMemberAccountResolverService.name,
  );

  constructor(
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
  ) {}

  async resolveMemberLinkedinUnipileAccount(
    args: ResolveMemberLinkedinUnipileAccountArgs,
  ): Promise<LinkedinUnipileMemberAccountResolution> {
    const cleanupContext =
      args.cleanupContext?.trim() || 'LinkedIn Unipile member account resolution';
    const reconnectLogContext =
      args.reconnectLogContext?.trim() || 'member LinkedIn Unipile account';

    let staleProfileAccountCleared = false;
    let accountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        args.workspaceMemberId,
        args.workspaceId,
        args.authToken,
        'linkedin',
      );

    let accountStatus: LinkedinUnipileMemberAccountStatus = 'not_connected';
    let isConnected = false;
    let resolution: LinkedinUnipileMemberAccountResolution['resolution'] =
      'none';
    let reconnectAttempted = false;
    let reconnectSucceeded = false;
    let reconnectMessage: string | null = null;
    let accountCreatedThisSession = false;

    if (accountId) {
      const storedResolution = await this.tryResolveStoredProfileAccountId({
        accountId,
        workspaceMemberId: args.workspaceMemberId,
        workspaceId: args.workspaceId,
        authToken: args.authToken,
        cleanupContext,
      });

      if (storedResolution.kind === 'active') {
        return {
          accountId: storedResolution.accountId,
          accountStatus: storedResolution.accountStatus,
          isConnected: storedResolution.isConnected,
          resolution: 'stored_profile',
          reconnectAttempted: false,
          reconnectSucceeded: false,
          reconnectMessage: null,
          accountCreatedThisSession: false,
          staleProfileAccountCleared: storedResolution.staleProfileAccountCleared,
        };
      }

      staleProfileAccountCleared = storedResolution.staleProfileAccountCleared;
      accountId = null;
      accountStatus = 'not_connected';
    }

    const usableExisting =
      await this.memberLinkedinUnipileConnectionService.findUsableLinkedinAccountForMember(
        args.workspaceMemberId,
        args.authToken,
      );
    if (usableExisting?.id) {
      await this.applyExistingAccountToProfile(
        args.workspaceMemberId,
        args.authToken,
        usableExisting.id,
      );
      return {
        accountId: usableExisting.id,
        accountStatus: 'connected',
        isConnected: true,
        resolution: 'usable_existing',
        reconnectAttempted: false,
        reconnectSucceeded: false,
        reconnectMessage: null,
        accountCreatedThisSession: false,
        staleProfileAccountCleared,
      };
    }

    const identityResolution = await this.tryResolveIdentityMatch({
      workspaceMemberId: args.workspaceMemberId,
      authToken: args.authToken,
    });
    if (identityResolution.kind === 'connected') {
      return {
        accountId: identityResolution.accountId,
        accountStatus: 'connected',
        isConnected: true,
        resolution: 'identity_match',
        reconnectAttempted: false,
        reconnectSucceeded: false,
        reconnectMessage: null,
        accountCreatedThisSession: false,
        staleProfileAccountCleared,
      };
    }

    const reconnectSourceToken = args.reconnectSourceToken?.trim() ?? '';
    if (!reconnectSourceToken) {
      return {
        accountId: null,
        accountStatus,
        isConnected,
        resolution: 'none',
        reconnectAttempted: false,
        reconnectSucceeded: false,
        reconnectMessage: null,
        accountCreatedThisSession: false,
        staleProfileAccountCleared,
      };
    }

    reconnectAttempted = true;

    try {
      const reconnectResult =
        await this.memberLinkedinUnipileConnectionService.withMemberLinkedinConnectLock(
          args.workspaceMemberId,
          async () =>
            this.reconnectFromCookiesUnderLock({
              workspaceMemberId: args.workspaceMemberId,
              authToken: args.authToken,
              reconnectSourceToken,
              premiumToken: args.premiumToken?.trim() ?? undefined,
              userAgent: args.userAgent?.trim() ?? undefined,
              ip: args.ip?.trim() ?? undefined,
              country: args.country?.trim() ?? undefined,
              omitReconnectAccountId:
                args.omitReconnectAccountId === true ||
                staleProfileAccountCleared,
              reconnectLogContext,
            }),
        );

      accountId = reconnectResult.accountId;
      accountStatus = reconnectResult.accountStatus;
      isConnected = reconnectResult.isConnected;
      resolution = reconnectResult.resolution;
      reconnectSucceeded = reconnectResult.reconnectSucceeded;
      reconnectMessage = reconnectResult.reconnectMessage;
      accountCreatedThisSession = reconnectResult.accountCreatedThisSession;
    } catch (error) {
      reconnectMessage =
        error instanceof Error ? error.message : 'Failed to reconnect';
      this.logger.warn(
        `LinkedIn Unipile reconnect failed for member ${args.workspaceMemberId}: ${reconnectMessage}`,
      );

      if (isUnipileInvalidLinkedinCookieCredentialsError(error)) {
        this.logger.log(
          `[resolveMemberLinkedinUnipileAccount] Clearing stored LinkedIn cookies for workspaceMemberId=${args.workspaceMemberId} after invalid credentials`,
        );
        await this.workspaceMemberProfileUnipileService.clearWorkspaceMemberLinkedinCookieTokens(
          args.authToken,
          args.workspaceMemberId,
        );
      }
    }

    if (
      accountId &&
      (accountStatus === 'connected' || accountStatus === 'pending')
    ) {
      isConnected = true;
    }

    return {
      accountId,
      accountStatus,
      isConnected,
      resolution,
      reconnectAttempted,
      reconnectSucceeded,
      reconnectMessage,
      accountCreatedThisSession,
      staleProfileAccountCleared,
    };
  }

  private async tryResolveStoredProfileAccountId(args: {
    accountId: string;
    workspaceMemberId: string;
    workspaceId: string;
    authToken: string;
    cleanupContext: string;
  }): Promise<
    | {
        kind: 'active';
        accountId: string;
        accountStatus: LinkedinUnipileMemberAccountStatus;
        isConnected: boolean;
        staleProfileAccountCleared: boolean;
      }
    | {
        kind: 'inactive';
        staleProfileAccountCleared: boolean;
      }
  > {
    const account =
      await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
        args.accountId,
      );

    if (account) {
      const mappedStatus =
        this.linkedinUnipileRequestService.mapAccountStatus(account);
      if (
        mappedStatus === 'connected' ||
        mappedStatus === 'pending' ||
        isUnipileConnectedStatus(account.status)
      ) {
        const isConnected =
          mappedStatus === 'connected' ||
          mappedStatus === 'pending' ||
          isUnipileConnectedStatus(account.status);

        return {
          kind: 'active',
          accountId: args.accountId,
          accountStatus: mappedStatus,
          isConnected,
          staleProfileAccountCleared: false,
        };
      }

      if (mappedStatus === 'disconnected') {
        await this.memberLinkedinUnipileConnectionService.cleanupUnusableStoredLinkedinAccountIfNeeded(
          args.workspaceMemberId,
          args.authToken,
          args.accountId,
          args.cleanupContext,
          args.workspaceId,
        );
        return { kind: 'inactive', staleProfileAccountCleared: false };
      }
    }

    const staleProfileAccountCleared =
      await this.memberLinkedinUnipileConnectionService.clearStaleStoredLinkedinAccountIdIfNeeded(
        args.workspaceMemberId,
        args.authToken,
        args.accountId,
        args.workspaceId,
      );

    return { kind: 'inactive', staleProfileAccountCleared };
  }

  private async tryResolveIdentityMatch(args: {
    workspaceMemberId: string;
    authToken: string;
  }): Promise<
    | { kind: 'connected'; accountId: string }
    | { kind: 'blocked' }
    | { kind: 'none' }
  > {
    try {
      const profile =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberProfileUnipileFields(
          args.workspaceMemberId,
          args.authToken,
        );
      const { accounts } =
        await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
      const match = findLinkedinUnipileAccountSameIdentityForProfile(
        accounts as UnipileLinkedinAccount[],
        profile,
      );

      if (!match) {
        return { kind: 'none' };
      }

      if (isUnipileConnectedStatus(match.status)) {
        await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
          args.workspaceMemberId,
          args.authToken,
          'linkedin',
          match.id,
          match,
        );
        return { kind: 'connected', accountId: match.id };
      }

      if (shouldBlockNewUnipileConnectionForStatus(match.status)) {
        throw new HttpException(
          {
            message:
              'A LinkedIn connection is already in progress for this profile. Wait for it to finish or disconnect it before retrying.',
            existing_account_id: match.id,
          },
          HttpStatus.CONFLICT,
        );
      }

      return { kind: 'none' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return { kind: 'none' };
    }
  }

  private async reconnectFromCookiesUnderLock(args: {
    workspaceMemberId: string;
    authToken: string;
    reconnectSourceToken: string;
    premiumToken?: string;
    userAgent?: string;
    ip?: string;
    country?: string;
    omitReconnectAccountId: boolean;
    reconnectLogContext: string;
  }): Promise<{
    accountId: string | null;
    accountStatus: LinkedinUnipileMemberAccountStatus;
    isConnected: boolean;
    resolution: LinkedinUnipileMemberAccountResolution['resolution'];
    reconnectSucceeded: boolean;
    reconnectMessage: string | null;
    accountCreatedThisSession: boolean;
  }> {
    const usableExisting =
      await this.memberLinkedinUnipileConnectionService.findUsableLinkedinAccountForMember(
        args.workspaceMemberId,
        args.authToken,
      );
    if (usableExisting?.id) {
      await this.applyExistingAccountToProfile(
        args.workspaceMemberId,
        args.authToken,
        usableExisting.id,
      );
      return {
        accountId: usableExisting.id,
        accountStatus: 'connected',
        isConnected: true,
        resolution: 'usable_existing',
        reconnectSucceeded: true,
        reconnectMessage:
          'Reused existing Unipile LinkedIn account for this profile',
        accountCreatedThisSession: false,
      };
    }

    const identityMatch =
      await this.memberLinkedinUnipileConnectionService.findLinkedinAccountSameIdentityForMember(
        args.workspaceMemberId,
        args.authToken,
      );
    if (identityMatch && isUnipileConnectedStatus(identityMatch.status)) {
      await this.applyExistingAccountToProfile(
        args.workspaceMemberId,
        args.authToken,
        identityMatch.id,
      );
      return {
        accountId: identityMatch.id,
        accountStatus: 'connected',
        isConnected: true,
        resolution: 'identity_match',
        reconnectSucceeded: true,
        reconnectMessage:
          'Matched existing connected Unipile LinkedIn account before reconnect',
        accountCreatedThisSession: false,
      };
    }

    const reconnectAccountIdForUnipile = args.omitReconnectAccountId
      ? undefined
      : identityMatch && !isUnipileConnectedStatus(identityMatch.status)
        ? identityMatch.id
        : undefined;

    this.logger.log(
      `LinkedIn reconnect via POST /accounts (${args.reconnectLogContext}) workspaceMemberId=${args.workspaceMemberId}${reconnectAccountIdForUnipile ? ` reconnect_account=${reconnectAccountIdForUnipile}` : ''}`,
    );

    const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
      '/api/v1/accounts',
      'POST',
      buildUnipileLinkedinCookieConnectBody({
        accessToken: args.reconnectSourceToken,
        premiumToken: args.premiumToken,
        userAgent: args.userAgent,
        ip: args.ip,
        country: args.country,
        reconnectAccountId: reconnectAccountIdForUnipile,
      }),
      { returnStatus: true },
    )) as UnipileConnectHttpResult;

    const { status, data } = result;
    const rawAccountId = data?.id || data?.account_id || null;
    const isCheckpoint =
      (status === 202 && data?.account_id) ||
      (data?.object === 'Checkpoint' && data?.account_id);

    let accountId: string | null = null;
    if (rawAccountId) {
      accountId =
        await this.memberLinkedinUnipileConnectionService.syncMemberLinkedinAccountAfterConnect(
          args.workspaceMemberId,
          args.authToken,
          rawAccountId,
        );
    }

    if (isCheckpoint) {
      return {
        accountId,
        accountStatus: 'checkpoint_required',
        isConnected: false,
        resolution: 'cookie_reconnect',
        reconnectSucceeded: true,
        reconnectMessage: 'LinkedIn checkpoint required',
        accountCreatedThisSession: accountId === rawAccountId,
      };
    }

    if (accountId) {
      return {
        accountId,
        accountStatus: 'connected',
        isConnected: true,
        resolution: 'cookie_reconnect',
        reconnectSucceeded: true,
        reconnectMessage: null,
        accountCreatedThisSession: accountId === rawAccountId,
      };
    }

    return {
      accountId: null,
      accountStatus: 'not_connected',
      isConnected: false,
      resolution: 'none',
      reconnectSucceeded: false,
      reconnectMessage: 'Failed to create LinkedIn Unipile session',
      accountCreatedThisSession: false,
    };
  }

  private async applyExistingAccountToProfile(
    workspaceMemberId: string,
    authToken: string,
    accountId: string,
  ): Promise<void> {
    const accountPayload =
      await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
        accountId,
      );
    if (accountPayload) {
      await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
        workspaceMemberId,
        authToken,
        'linkedin',
        accountId,
        accountPayload,
      );
      return;
    }

    await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      authToken,
      'linkedin',
      accountId,
    );
  }
}
