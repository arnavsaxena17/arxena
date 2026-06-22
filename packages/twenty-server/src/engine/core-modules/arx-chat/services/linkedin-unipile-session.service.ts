import { Injectable, Logger } from '@nestjs/common';

import { lookupCountryByIp } from 'twenty-shared';
import { EnvironmentService } from '../../environment/environment.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { LinkedinUnipileMemberAccountResolverService } from './linkedin-unipile-member-account-resolver.service';
import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { LinkedinUnipileTeardownSchedulerService } from './linkedin-unipile-teardown-scheduler.service';
import { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

export type LinkedinUnipileAccountIdSource =
  | 'explicit_request'
  | 'workspace_member_profile'
  | 'env_fallback'
  | 'on_demand_cookie_reconnect';

export type LinkedinSessionHandle = {
  accountId: string;
  accountIdSource: LinkedinUnipileAccountIdSource;
  inferredSearchType: 'classic' | 'sales_navigator' | 'recruiter';
  salesNavigatorAvailable: boolean;
  recruiterAvailable: boolean;
};

type LinkedinSessionContext = {
  accountId: string;
  accountIdSource: LinkedinUnipileAccountIdSource;
  accountCreatedThisSession: boolean;
  disconnectAfterUse: boolean;
  workspaceMemberId: string | null;
  authToken: string;
};

@Injectable()
export class LinkedinUnipileSessionService {
  private readonly logger = new Logger(LinkedinUnipileSessionService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly memberLinkedinUnipileConnectionService: MemberLinkedinUnipileConnectionService,
    private readonly linkedinUnipileTeardownSchedulerService: LinkedinUnipileTeardownSchedulerService,
    private readonly linkedinUnipileMemberAccountResolverService: LinkedinUnipileMemberAccountResolverService,
  ) {}

  private isOnDemandModeEnabled(): boolean {
    return this.environmentService.get('LINKEDIN_UNIPILE_ON_DEMAND');
  }

  private logResolvedAccountId(
    accountId: string,
    source: LinkedinUnipileAccountIdSource,
    details?: string,
  ): void {
    const suffix = details ? ` (${details})` : '';
    this.logger.log(
      `Resolved LinkedIn Unipile accountId=${accountId} source=${source}${suffix}`,
    );
  }

  private async resolveStoredOrEnvFallback(
    apiToken: string,
    explicitAccountId?: string,
  ): Promise<{ accountId: string; source: LinkedinUnipileAccountIdSource }> {
    const explicit = explicitAccountId?.trim();
    if (explicit) {
      return { accountId: explicit, source: 'explicit_request' };
    }

    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
      const linkedinAccountId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId,
          workspaceId,
          apiToken,
          'linkedin',
        );

      if (linkedinAccountId) {
        const account =
          await this.linkedinUnipileRequestService.fetchAccountByIdIfExists(
            linkedinAccountId,
          );
        if (account) {
          return {
            accountId: linkedinAccountId,
            source: 'workspace_member_profile',
          };
        }

        if (workspaceMemberId) {
          await this.memberLinkedinUnipileConnectionService.clearStaleStoredLinkedinAccountIdIfNeeded(
            workspaceMemberId,
            apiToken,
            linkedinAccountId,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Workspace member LinkedIn Unipile account lookup failed, trying env fallback: ${error}`,
      );
    }

    const envFallback = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID?.trim();
    if (envFallback) {
      return { accountId: envFallback, source: 'env_fallback' };
    }

    throw new Error('Failed to get LinkedIn account ID');
  }

  private mapResolutionToAccountIdSource(
    resolution: Awaited<
      ReturnType<
        LinkedinUnipileMemberAccountResolverService['resolveMemberLinkedinUnipileAccount']
      >
    >['resolution'],
  ): LinkedinUnipileAccountIdSource {
    if (resolution === 'cookie_reconnect') {
      return 'on_demand_cookie_reconnect';
    }

    return 'workspace_member_profile';
  }

  private async ensureLinkedinSessionContext(
    apiToken: string,
    explicitAccountId?: string,
  ): Promise<LinkedinSessionContext> {
    const explicit = explicitAccountId?.trim();
    if (explicit) {
      this.logResolvedAccountId(explicit, 'explicit_request');
      return {
        accountId: explicit,
        accountIdSource: 'explicit_request',
        accountCreatedThisSession: false,
        disconnectAfterUse: false,
        workspaceMemberId: null,
        authToken: apiToken,
      };
    }

    if (!this.isOnDemandModeEnabled()) {
      const resolved = await this.resolveStoredOrEnvFallback(apiToken);
      this.logResolvedAccountId(resolved.accountId, resolved.source);
      return {
        accountId: resolved.accountId,
        accountIdSource: resolved.source,
        accountCreatedThisSession: false,
        disconnectAfterUse: false,
        workspaceMemberId: null,
        authToken: apiToken,
      };
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);
    const workspaceMemberId =
      await this.workspaceQueryService.getWorkspaceMemberIdFromToken(apiToken);
    if (!workspaceMemberId) {
      throw new Error(
        'Workspace member id could not be resolved from auth token for LinkedIn Unipile session',
      );
    }
    const keepConnected =
      await this.workspaceMemberProfileUnipileService.getKeepLinkedinConnected(
        workspaceMemberId,
        apiToken,
      );
    const storedCookies =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        apiToken,
        workspaceMemberId,
      );
    const reconnectSourceToken =
      storedCookies.linkedinLiAtToken ?? storedCookies.linkedinLiAToken;

    if (!reconnectSourceToken) {
      throw new Error(
        'No LinkedIn cookies stored on the workspace member profile',
      );
    }

    const storedCountry =
      storedCookies.linkedinCountry ??
      (storedCookies.linkedinIp
        ? (await lookupCountryByIp(storedCookies.linkedinIp)) ??
          undefined
        : undefined);

    const resolution =
      await this.linkedinUnipileMemberAccountResolverService.resolveMemberLinkedinUnipileAccount(
        {
          workspaceId,
          workspaceMemberId,
          authToken: apiToken,
          reconnectSourceToken,
          premiumToken: storedCookies.linkedinLiAToken,
          userAgent: storedCookies.linkedinUserAgent,
          ip: storedCookies.linkedinIp,
          country: storedCountry,
          cleanupContext: 'on-demand LinkedIn Unipile session',
          reconnectLogContext: 'on-demand session',
        },
      );

    if (!resolution.accountId) {
      throw new Error('Failed to resolve LinkedIn Unipile account for on-demand session');
    }

    const accountIdSource = this.mapResolutionToAccountIdSource(
      resolution.resolution,
    );

    this.logResolvedAccountId(
      resolution.accountId,
      accountIdSource,
      `workspaceMemberId=${workspaceMemberId} createdThisSession=${resolution.accountCreatedThisSession}`,
    );

    return {
      accountId: resolution.accountId,
      accountIdSource,
      accountCreatedThisSession: resolution.accountCreatedThisSession,
      disconnectAfterUse: !keepConnected,
      workspaceMemberId,
      authToken: apiToken,
    };
  }

  async ensureLinkedinAccountId(
    apiToken: string,
    explicitAccountId?: string,
  ): Promise<string> {
    const context = await this.ensureLinkedinSessionContext(
      apiToken,
      explicitAccountId,
    );
    return context.accountId;
  }

  private async buildSessionHandle(
    context: LinkedinSessionContext,
  ): Promise<LinkedinSessionHandle> {
    const capabilities =
      await this.linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount(
        context.accountId,
      );

    return {
      accountId: context.accountId,
      accountIdSource: context.accountIdSource,
      inferredSearchType: capabilities?.inferredSearchType ?? 'classic',
      salesNavigatorAvailable: capabilities?.salesNavigatorAvailable ?? false,
      recruiterAvailable: capabilities?.recruiterAvailable ?? false,
    };
  }

  private async disconnectSessionIfNeeded(
    context: LinkedinSessionContext,
  ): Promise<void> {
    if (!context.disconnectAfterUse || !context.workspaceMemberId) {
      return;
    }

    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(context.authToken);

    this.logger.log(
      `Scheduling idle LinkedIn Unipile disconnect after use: accountId=${context.accountId} accountIdSource=${context.accountIdSource} accountCreatedThisSession=${context.accountCreatedThisSession} workspaceMemberId=${context.workspaceMemberId}`,
    );

    await this.linkedinUnipileTeardownSchedulerService.scheduleIdleDisconnect({
      accountId: context.accountId,
      workspaceMemberId: context.workspaceMemberId,
      workspaceId,
      authToken: context.authToken,
    });
  }

  private async cancelPendingIdleDisconnectIfNeeded(
    context: LinkedinSessionContext,
  ): Promise<void> {
    if (!context.disconnectAfterUse || !context.workspaceMemberId) {
      return;
    }

    await this.linkedinUnipileTeardownSchedulerService.cancelPendingDisconnect(
      context.workspaceMemberId,
    );
  }

  async withLinkedinAccountId<T>(
    apiToken: string,
    explicitAccountId: string | undefined,
    run: (accountId: string) => Promise<T>,
  ): Promise<T> {
    return this.withLinkedinSession(apiToken, explicitAccountId, async (session) =>
      run(session.accountId),
    );
  }

  async withLinkedinSession<T>(
    apiToken: string,
    explicitAccountId: string | undefined,
    run: (session: LinkedinSessionHandle) => Promise<T>,
  ): Promise<T> {
    const context = await this.ensureLinkedinSessionContext(
      apiToken,
      explicitAccountId,
    );
    await this.cancelPendingIdleDisconnectIfNeeded(context);
    const session = await this.buildSessionHandle(context);

    try {
      return await run(session);
    } finally {
      await this.disconnectSessionIfNeeded(context);
    }
  }
}
