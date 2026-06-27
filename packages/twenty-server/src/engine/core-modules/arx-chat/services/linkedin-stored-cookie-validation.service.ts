import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { lookupCountryByIp } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import {
  normalizeLinkedinConnectionCountry,
  normalizeLinkedinConnectionIp,
  resolveLinkedinConnectUserAgent,
} from '../utils/build-unipile-linkedin-cookie-connect-body.util';
import { LinkedinUnipileMemberAccountResolverService } from './linkedin-unipile-member-account-resolver.service';
import { LinkedinUnipileTeardownSchedulerService } from './linkedin-unipile-teardown-scheduler.service';
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
    private readonly linkedinUnipileTeardownSchedulerService: LinkedinUnipileTeardownSchedulerService,
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

    const userAgent = resolveLinkedinConnectUserAgent({
      storedUserAgent: storedCookies.linkedinUserAgent,
      requestUserAgent: params.userAgent,
    });
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
    this.logger.log(`Resolving member linkedin unipile account for workspace member id: ${params.workspaceMemberId}`);
    this.logger.log(`Workspace id in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${params.workspace.id}`);
    this.logger.log(`Auth token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${params.authToken}`);
    this.logger.log(`Reconnect source token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${storedCookies.linkedinLiAtToken}`);
    this.logger.log(`Premium token in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${storedCookies.linkedinLiAToken}`);
    this.logger.log(`User agent in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${userAgent}`);
    this.logger.log(`Ip in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${ip}`);
    this.logger.log(`Country in RESOLVE MEMBER LINKEDIN UNIPILE ACCOUNT: ${country}`);
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
      this.logger.log(`Workspace member id in GET KEEP LINKEDIN CONNECTED: ${params.workspaceMemberId}`);
      this.logger.log(`Auth token in GET KEEP LINKEDIN CONNECTED: ${params.authToken}`);
      this.logger.log(`Keep connected in VALIDATE STORED COOKIES FOR MEMBER: ${keepConnected}`);
    let disconnectedAfterValidation = false;
    const shouldDisconnectAfterValidation =
      connected &&
      accountId != null &&
      (params.forceDisconnectAfterValidation === true || !keepConnected);

    if (shouldDisconnectAfterValidation && accountId) {
      this.logger.log(
        `[validateStoredCookies] scheduling idle disconnect after validation accountId=${accountId} ` +
          `workspaceMemberId=${params.workspaceMemberId}`,
      );
      await this.linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect({
        accountId,
        workspaceMemberId: params.workspaceMemberId,
        workspaceId: params.workspace.id,
        authToken: params.authToken,
      });
      disconnectedAfterValidation = true;
    }


    this.logger.log(`Connected in VALIDATE STORED COOKIES FOR MEMBER: ${connected}`);
    this.logger.log(`Account id in VALIDATE STORED COOKIES FOR MEMBER: ${accountId}`);
    this.logger.log(`Workspace member id in VALIDATE STORED COOKIES FOR MEMBER: ${params.workspaceMemberId}`);
    this.logger.log(`Auth token in VALIDATE STORED COOKIES FOR MEMBER: ${params.authToken}`);
    this.logger.log(`Workspace id in VALIDATE STORED COOKIES FOR MEMBER: ${params.workspace.id}`);
    this.logger.log(`Log context in VALIDATE STORED COOKIES FOR MEMBER: ${logContext}`);
    this.logger.log(`Audience in VALIDATE STORED COOKIES FOR MEMBER: ${audience}`);
    this.logger.log(`Force disconnect after validation in VALIDATE STORED COOKIES FOR MEMBER: ${params.forceDisconnectAfterValidation}`);
    if (connected) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieTokens(
        params.authToken,
        params.workspaceMemberId,
        {},
        { touchLastValidatedAt: true },
      );
    }

    this.logger.log(`Updating workspace member linkedin cookie tokens in VALIDATE STORED COOKIES FOR MEMBER`);
    this.logger.log(`Auth token in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${params.authToken}`);
    this.logger.log(`Workspace member id in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${params.workspaceMemberId}`);
    this.logger.log(`Workspace id in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${params.workspace.id}`);
    this.logger.log(`Log context in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${logContext}`);
    this.logger.log(`Audience in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${audience}`);
    this.logger.log(`Force disconnect after validation in UPDATE WORKSPACE MEMBER LINKEDIN COOKIE TOKENS: ${params.forceDisconnectAfterValidation}`);
    const storedCookiesAfter =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        params.authToken,
        params.workspaceMemberId,
      );

    this.logger.log(`Stored cookies after in VALIDATE STORED COOKIES FOR MEMBER: ${JSON.stringify(storedCookiesAfter, null, 2)}`);

    const message =
      resolution.reconnectMessage ??
      (connected
        ? disconnectedAfterValidation
          ? 'LinkedIn connection succeeded; idle disconnect scheduled after validation'
          : 'LinkedIn connection succeeded'
        : 'LinkedIn connection failed with stored cookies');

    this.logger.log(`Message in VALIDATE STORED COOKIES FOR MEMBER: ${message}`);
    this.logger.log(`Reconnect attempted in VALIDATE STORED COOKIES FOR MEMBER: ${resolution.reconnectAttempted}`);
    this.logger.log(`Reconnect succeeded in VALIDATE STORED COOKIES FOR MEMBER: ${resolution.reconnectSucceeded}`);
    this.logger.log(`Account id in VALIDATE STORED COOKIES FOR MEMBER: ${accountId ?? null}`);
    this.logger.log(`Account status in VALIDATE STORED COOKIES FOR MEMBER: ${accountStatus ?? null}`);

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
