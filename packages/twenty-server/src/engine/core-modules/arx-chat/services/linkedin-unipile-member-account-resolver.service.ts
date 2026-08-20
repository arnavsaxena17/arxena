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

    this.logger.log(`Resolve member linkedin unipile account for workspace member id: ${args.workspaceMemberId}`);
    this.logger.log(`Workspace id in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.workspaceId}`);
    this.logger.log(`Auth token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.authToken}`);
    this.logger.log(`Reconnect source token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.reconnectSourceToken?.trim() ?? undefined}`);
    this.logger.log(`Premium token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.premiumToken?.trim() ?? undefined}`);
    this.logger.log(`User agent in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.userAgent?.trim() ?? undefined}`);
    this.logger.log(`Ip in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${args.ip?.trim() ?? undefined}`);
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
      this.logger.log(`Trying to resolve stored profile account id in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT`);
      this.logger.log(`Account id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${accountId}`);
      this.logger.log(`Workspace member id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.workspaceMemberId}`);
      this.logger.log(`Workspace id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.workspaceId}`);
      this.logger.log(`Auth token in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.authToken}`);
      this.logger.log(`Cleanup context in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${cleanupContext}`);
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
      this.logger.log(`With member linkedin connect lock in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT`);
      this.logger.log(`Workspace member id in WITH MEMBER LINKEDIN CONNECT LOCK: ${args.workspaceMemberId}`);
      this.logger.log(`Reconnect source token in WITH MEMBER LINKEDIN CONNECT LOCK: ${reconnectSourceToken}`);
      this.logger.log(`Premium token in WITH MEMBER LINKEDIN CONNECT LOCK: ${args.premiumToken?.trim() ?? undefined}`);
      this.logger.log(`User agent in WITH MEMBER LINKEDIN CONNECT LOCK: ${args.userAgent?.trim() ?? undefined}`);
      this.logger.log(`Ip in WITH MEMBER LINKEDIN CONNECT LOCK: ${args.ip?.trim() ?? undefined}`);
      this.logger.log(`Country in WITH MEMBER LINKEDIN CONNECT LOCK: ${args.country?.trim() ?? undefined}`);
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

      this.logger.log(`Reconnect result in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${JSON.stringify(reconnectResult, null, 2)}`);

      accountId = reconnectResult.accountId;
      accountStatus = reconnectResult.accountStatus;
      isConnected = reconnectResult.isConnected;
      resolution = reconnectResult.resolution;
      reconnectSucceeded = reconnectResult.reconnectSucceeded;
      reconnectMessage = reconnectResult.reconnectMessage;
      accountCreatedThisSession = reconnectResult.accountCreatedThisSession;

      this.logger.log(`Account id in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${accountId}`);
      this.logger.log(`Account status in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${accountStatus}`);
      this.logger.log(`Is connected in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${isConnected}`);
      this.logger.log(`Resolution in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${resolution}`);
      this.logger.log(`Reconnect succeeded in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${reconnectSucceeded}`);
      this.logger.log(`Reconnect message in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${reconnectMessage}`);
      this.logger.log(`Account created this session in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${accountCreatedThisSession}`);
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

    this.logger.log(`Trying to resolve stored profile account id: ${args.accountId}`);
    this.logger.log(`Account id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.accountId}`);
    this.logger.log(`Workspace member id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.workspaceMemberId}`);
    this.logger.log(`Workspace id in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.workspaceId}`);
    this.logger.log(`Auth token in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.authToken}`);
    this.logger.log(`Cleanup context in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${args.cleanupContext}`);
    const account =
      await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
        args.accountId,
      );
    this.logger.log(`Account in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${JSON.stringify(account, null, 2)}`);
    if (account) {
      const mappedStatus =
        this.linkedinUnipileRequestService.mapAccountStatus(account);
      this.logger.log(`Mapped status in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${mappedStatus}`);
      if (
        mappedStatus === 'connected' ||
        mappedStatus === 'pending' ||
        isUnipileConnectedStatus(account.status)
      ) {
        const isConnected =
          mappedStatus === 'connected' ||
          mappedStatus === 'pending' ||
          isUnipileConnectedStatus(account.status);
        this.logger.log(`Is connected in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${isConnected}`);
        return {
          kind: 'active',
          accountId: args.accountId,
          accountStatus: mappedStatus,
          isConnected,
          staleProfileAccountCleared: false,
        };
      }
      this.logger.log(`Mapped status in TRY RESOLVE STORED PROFILE ACCOUNT ID: ${mappedStatus}`); 
      if (mappedStatus === 'disconnected') {
        this.logger.log(`Cleaning up unusable stored linkedin account if needed in TRY RESOLVE STORED PROFILE ACCOUNT ID`);
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
    this.logger.log(`Reconnect from cookies under lock for workspace member id: ${args.workspaceMemberId}`);
    this.logger.log(`Auth token in RECONNECT FROM COOKIES UNDER LOCK: ${args.authToken}`);
    this.logger.log(`Reconnect source token in RECONNECT FROM COOKIES UNDER LOCK: ${args.reconnectSourceToken}`);
    this.logger.log(`Premium token in RECONNECT FROM COOKIES UNDER LOCK: ${args.premiumToken?.trim() ?? undefined}`);
    this.logger.log(`User agent in RECONNECT FROM COOKIES UNDER LOCK: ${args.userAgent?.trim() ?? undefined}`);
    this.logger.log(`Ip in RECONNECT FROM COOKIES UNDER LOCK: ${args.ip?.trim() ?? undefined}`);
    this.logger.log(`Country in RECONNECT FROM COOKIES UNDER LOCK: ${args.country?.trim() ?? undefined}`);
    const reconnectSourceToken = args.reconnectSourceToken?.trim() ?? '';
    if (!reconnectSourceToken) {
      this.logger.warn(
        `Skipping POST /accounts (${args.reconnectLogContext}): empty li_at workspaceMemberId=${args.workspaceMemberId}`,
      );
      return {
        accountId: null,
        accountStatus: 'not_connected',
        isConnected: false,
        resolution: 'none',
        reconnectSucceeded: false,
        reconnectMessage: 'No LinkedIn li_at cookie available for Unipile connect',
        accountCreatedThisSession: false,
      };
    }

    const usableExisting =
      await this.memberLinkedinUnipileConnectionService.findUsableLinkedinAccountForMember(
        args.workspaceMemberId,
        args.authToken,
      );
    this.logger.log(`Usable existing in RECONNECT FROM COOKIES UNDER LOCK: ${JSON.stringify(usableExisting, null, 2)}`);
    if (usableExisting?.id) {
      await this.applyExistingAccountToProfile(
        args.workspaceMemberId,
        args.authToken,
        usableExisting.id,
      );
      this.logger.log(`Account id in RECONNECT FROM COOKIES UNDER LOCK: ${usableExisting.id}`);
      this.logger.log(`Account status in RECONNECT FROM COOKIES UNDER LOCK: connected`);
      this.logger.log(`Is connected in RECONNECT FROM COOKIES UNDER LOCK: true`);
      this.logger.log(`Resolution in RECONNECT FROM COOKIES UNDER LOCK: usable_existing`);
      this.logger.log(`Reconnect succeeded in RECONNECT FROM COOKIES UNDER LOCK: true`);
      this.logger.log(`Reconnect message in RECONNECT FROM COOKIES UNDER LOCK: Reused existing Unipile LinkedIn account for this profile`);
      this.logger.log(`Account created this session in RECONNECT FROM COOKIES UNDER LOCK: false`);
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
    this.logger.log(`Identity match in RECONNECT FROM COOKIES UNDER LOCK: ${JSON.stringify(identityMatch, null, 2)}`);
    if (identityMatch && isUnipileConnectedStatus(identityMatch.status)) {
      await this.applyExistingAccountToProfile(
        args.workspaceMemberId,
        args.authToken,
        identityMatch.id,
      );
      this.logger.log(`Account id in RECONNECT FROM COOKIES UNDER LOCK: ${identityMatch.id}`);
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

    this.logger.log(`Reconnect account id for unipile in RECONNECT FROM COOKIES UNDER LOCK: ${reconnectAccountIdForUnipile}`);
    this.logger.log(`Reconnect source token in RECONNECT FROM COOKIES UNDER LOCK: ${args.reconnectSourceToken}`);
    this.logger.log(`Premium token in RECONNECT FROM COOKIES UNDER LOCK: ${args.premiumToken}`);
    this.logger.log(`User agent in RECONNECT FROM COOKIES UNDER LOCK: ${args.userAgent}`);
    this.logger.log(`Ip in RECONNECT FROM COOKIES UNDER LOCK: ${args.ip}`);
    this.logger.log(`Country in RECONNECT FROM COOKIES UNDER LOCK: ${args.country}`);
    const payload = buildUnipileLinkedinCookieConnectBody({
      accessToken: reconnectSourceToken,
      premiumToken: args.premiumToken ?? undefined,
      userAgent: args.userAgent ?? undefined,
      ip: args.ip ?? undefined,
      country: args.country ?? undefined,
      reconnectAccountId: reconnectAccountIdForUnipile ?? undefined,
    });

    this.logger.log(`Payload in RECONNECT FROM COOKIES UNDER LOCK: ${JSON.stringify(payload, null, 2)}`);

    
    const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
      '/api/v1/accounts',
      'POST',
      payload,
      { returnStatus: true },
    )) as UnipileConnectHttpResult;

    this.logger.log(`Result in RECONNECT FROM COOKIES UNDER LOCK: ${JSON.stringify(result, null, 2)}`);

    const { status, data } = result;
    const rawAccountId = data?.id || data?.account_id || null;
    this.logger.log(`Raw account id in RECONNECT FROM COOKIES UNDER LOCK: ${rawAccountId}`);
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

    this.logger.log(`Account id in RECONNECT FROM COOKIES UNDER LOCK: ${accountId}`);

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

    if (!accountId) {
      this.logger.log(`Account id in RECONNECT FROM COOKIES UNDER LOCK: null`);

      this.logger.log(`Account status in RECONNECT FROM COOKIES UNDER LOCK: not_connected`);
      this.logger.log(`Is connected in RECONNECT FROM COOKIES UNDER LOCK: false`);
      this.logger.log(`Resolution in RECONNECT FROM COOKIES UNDER LOCK: none`);
      this.logger.log(`Reconnect succeeded in RECONNECT FROM COOKIES UNDER LOCK: false`);
      this.logger.log(`Reconnect message in RECONNECT FROM COOKIES UNDER LOCK: Failed to create LinkedIn Unipile session`);
      this.logger.log(`Account created this session in RECONNECT FROM COOKIES UNDER LOCK: false`);

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

    const ready =
      await this.linkedinUnipileRequestService.waitForLinkedinAccountConnectReady(
        accountId,
      );
    this.logger.log(
      `LinkedIn account connect readiness in RECONNECT FROM COOKIES UNDER LOCK: status=${ready.status} timedOut=${ready.timedOut} accountId=${accountId}`,
    );

    if (ready.status === 'checkpoint_required') {
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

    if (ready.status === 'disconnected') {
      return {
        accountId,
        accountStatus: 'not_connected',
        isConnected: false,
        resolution: 'cookie_reconnect',
        reconnectSucceeded: false,
        reconnectMessage: ready.timedOut
          ? 'LinkedIn Unipile account did not become ready before timeout'
          : 'LinkedIn Unipile account failed to connect',
        accountCreatedThisSession: accountId === rawAccountId,
      };
    }

    const accountStatus =
      ready.status === 'connected' ? 'connected' : 'pending';
    const reconnectMessage =
      ready.timedOut && ready.status === 'pending'
        ? 'LinkedIn Unipile account is still connecting'
        : null;

    this.logger.log(`Account id in RECONNECT FROM COOKIES UNDER LOCK: ${accountId}`);
    return {
      accountId,
      accountStatus,
      isConnected: true,
      resolution: 'cookie_reconnect',
      reconnectSucceeded: true,
      reconnectMessage,
      accountCreatedThisSession: accountId === rawAccountId,
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
    this.logger.log(`Account payload in APPLY EXISTING ACCOUNT TO PROFILE: ${JSON.stringify(accountPayload, null, 2)}`);
    if (accountPayload) {
      this.logger.log(`Applying unipile account to workspace member profile in APPLY EXISTING ACCOUNT TO PROFILE`);
      this.logger.log(`Workspace member id in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${workspaceMemberId}`);
      this.logger.log(`Auth token in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${authToken}`);
      this.logger.log(`Type in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: linkedin`);
      this.logger.log(`Account id in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${accountId}`);
      this.logger.log(`Account payload in APPLY UNIPILE ACCOUNT TO WORKSPACE MEMBER PROFILE: ${JSON.stringify(accountPayload, null, 2)}`);
      await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
        workspaceMemberId,
        authToken,
        'linkedin',
        accountId,
        accountPayload,
      );
      return;
    }

    this.logger.log(`Updating workspace member unipile account id in APPLY EXISTING ACCOUNT TO PROFILE`);
    this.logger.log(`Workspace member id in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${workspaceMemberId}`);
    this.logger.log(`Auth token in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${authToken}`);
    this.logger.log(`Type in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: linkedin`);
    this.logger.log(`Account id in UPDATE WORKSPACE MEMBER UNIPILE ACCOUNT ID: ${accountId}`);

    await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
      workspaceMemberId,
      authToken,
      'linkedin',
      accountId,
    );
  }
}
