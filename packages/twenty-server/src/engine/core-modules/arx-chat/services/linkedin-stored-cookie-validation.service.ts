import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { lookupCountryByIp } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import {
    normalizeLinkedinConnectionCountry,
    normalizeLinkedinConnectionIp,
} from '../utils/build-unipile-linkedin-cookie-connect-body.util';
import { LinkedinUnipileMemberAccountResolverService } from './linkedin-unipile-member-account-resolver.service';
import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

export type ValidateStoredLinkedinCookiesResult = {
  attempted: boolean;
  connected: boolean;
  disconnectedAfterValidation: boolean;
  keepConnected: boolean;
  hasLiAt: boolean;
  hasLiA: boolean;
  lastSyncedAt: string | null;
  lastValidatedAt: string | null;
  message: string | null;
  errorCode: string | null;
  reconnectAttempted: boolean;
  reconnectSucceeded: boolean;
  accountId: string | null;
  accountStatus: string | null;
};

export type ValidateStoredLinkedinCookiesAudience = 'admin' | 'extension';

export type ValidateStoredLinkedinCookiesParams = {
  workspace: Workspace;
  workspaceMemberId: string;
  authToken: string;
  userAgent?: string;
  clientIp?: string;
  clientCountry?: string;
  logContext?: string;
  /** Admin diagnostics: only LINKEDIN_UNIPILE_VALIDATE_THEN_DISCONNECT. Extension: also requires on-demand. */
  audience?: ValidateStoredLinkedinCookiesAudience;
  /** Admin probe: always disconnect after a successful connect (ignore keepLinkedinConnected). */
  forceDisconnectAfterValidation?: boolean;
};

@Injectable()
export class LinkedinStoredCookieValidationService {
  private readonly logger = new Logger(LinkedinStoredCookieValidationService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
    private readonly linkedinUnipileMemberAccountResolverService: LinkedinUnipileMemberAccountResolverService,
  ) {}

  /**
   * Cookie sync (`extension/sync-cookies`, extension auto-connect) never calls this service.
   * Only explicit validate flows: admin panel test button and `extension/validate-session`.
   */
  assertValidateThenDisconnectEnabled(
    audience: ValidateStoredLinkedinCookiesAudience = 'extension',
  ): void {
    const validateThenDisconnect = this.environmentService.get(
      'LINKEDIN_UNIPILE_VALIDATE_THEN_DISCONNECT',
    );

    if (!validateThenDisconnect) {
      throw new HttpException(
        'LinkedIn validate-then-disconnect is disabled',
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      audience === 'extension' &&
      !this.environmentService.get('LINKEDIN_UNIPILE_ON_DEMAND')
    ) {
      throw new HttpException(
        'LinkedIn validate-then-disconnect is disabled',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async validateStoredCookiesForMember(
    params: ValidateStoredLinkedinCookiesParams,
  ): Promise<ValidateStoredLinkedinCookiesResult> {
    const audience = params.audience ?? 'extension';
    this.assertValidateThenDisconnectEnabled(audience);

    const logContext = params.logContext ?? 'stored LinkedIn cookie validation';
    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        params.authToken,
        params.workspaceMemberId,
      );

    const hasLiAt = Boolean(storedCookies.linkedinLiAtToken);
    const hasLiA = Boolean(storedCookies.linkedinLiAToken);

    if (!hasLiAt) {
      return {
        attempted: true,
        connected: false,
        disconnectedAfterValidation: false,
        keepConnected: false,
        hasLiAt: false,
        hasLiA,
        lastSyncedAt: storedCookies.linkedinCookiesLastSyncedAt,
        lastValidatedAt: storedCookies.linkedinCookiesValidatedAt,
        message: 'No stored LinkedIn li_at cookie on workspace member profile',
        errorCode: 'NO_STORED_LI_AT',
        reconnectAttempted: false,
        reconnectSucceeded: false,
        accountId: null,
        accountStatus: null,
      };
    }

    const userAgent =
      params.userAgent?.trim() || storedCookies.linkedinUserAgent?.trim() || undefined;
    const ip =
      normalizeLinkedinConnectionIp(
        params.clientIp?.trim() || storedCookies.linkedinIp?.trim() || undefined,
      ) ?? undefined;
    const country =
      normalizeLinkedinConnectionCountry(
        params.clientCountry?.trim() ||
          storedCookies.linkedinCountry?.trim() ||
          undefined,
      ) ??
      (ip ? ((await lookupCountryByIp(ip)) ?? undefined) : undefined);

    this.logger.log(
      `[validateStoredCookies] workspaceMemberId=${params.workspaceMemberId} context=${logContext} ` +
        `hasLiAt=${hasLiAt} hasLiA=${hasLiA} userAgent=${userAgent?.slice(0, 60) ?? 'none'} ` +
        `ip=${ip ?? 'none'} country=${country ?? 'none'}`,
    );

    const resolution =
      await this.linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount(
        {
          workspaceId: params.workspace.id,
          workspaceMemberId: params.workspaceMemberId,
          authToken: params.authToken,
          reconnectSourceToken: storedCookies.linkedinLiAtToken,
          premiumToken: storedCookies.linkedinLiAToken,
          userAgent,
          ip,
          country,
          cleanupContext: logContext,
          reconnectLogContext: logContext,
        },
      );

    const accountId = resolution.accountId;
    const accountStatus = resolution.accountStatus;
    let connected =
      resolution.isConnected ||
      accountStatus === 'connected' ||
      accountStatus === 'pending';

    const keepConnected =
      await this.workspaceMemberProfileUnipileService.getKeepLinkedinConnected(
        params.workspaceMemberId,
        params.authToken,
      );

    let disconnectedAfterValidation = false;
    const shouldDisconnectAfterValidation =
      connected &&
      accountId != null &&
      (params.forceDisconnectAfterValidation === true || !keepConnected);

    if (shouldDisconnectAfterValidation && accountId) {
      this.logger.log(
        `[validateStoredCookies] disconnecting after validation accountId=${accountId} ` +
          `workspaceMemberId=${params.workspaceMemberId}`,
      );
      await this.memberLinkedinUnipileConnectionService.disconnectMemberLinkedinUnipileAccount(
        {
          accountId,
          context: logContext,
          workspaceMemberId: params.workspaceMemberId,
          workspaceId: params.workspace.id,
          authToken: params.authToken,
          forceClearProfile: true,
        },
      );
      disconnectedAfterValidation = true;
    }

    if (connected) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens(
        params.authToken,
        params.workspaceMemberId,
        {},
        { touchLastValidatedAt: true },
      );
    }

    const storedCookiesAfter =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        params.authToken,
        params.workspaceMemberId,
      );

    const message =
      resolution.reconnectMessage ??
      (connected
        ? disconnectedAfterValidation
          ? 'LinkedIn connection succeeded and was disconnected after validation'
          : 'LinkedIn connection succeeded'
        : 'LinkedIn connection failed with stored cookies');

    return {
      attempted: true,
      connected,
      disconnectedAfterValidation,
      keepConnected,
      hasLiAt: Boolean(storedCookiesAfter.linkedinLiAtToken),
      hasLiA: Boolean(storedCookiesAfter.linkedinLiAToken),
      lastSyncedAt: storedCookiesAfter.linkedinCookiesLastSyncedAt,
      lastValidatedAt: storedCookiesAfter.linkedinCookiesValidatedAt,
      message,
      errorCode: connected ? null : 'LINKEDIN_CONNECTION_FAILED',
      reconnectAttempted: resolution.reconnectAttempted,
      reconnectSucceeded: resolution.reconnectSucceeded,
      accountId: accountId ?? null,
      accountStatus: accountStatus ?? null,
    };
  }
}
