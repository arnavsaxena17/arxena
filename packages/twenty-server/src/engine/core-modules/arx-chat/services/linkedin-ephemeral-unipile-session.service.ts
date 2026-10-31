import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';

import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import { WorkspaceMemberLinkedinSearchTypeService } from './workspace-member-linkedin-search-type.service';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

export type LinkedinEphemeralOperationContext =
  | 'org_chart_linkedin_search'
  | 'candidate_search'
  | 'org_chart_super_impose';

export type LinkedinEphemeralSearchType =
  | 'classic'
  | 'sales_navigator'
  | 'recruiter';

type EphemeralConnectResult = {
  accountId: string;
  status: 'connected' | 'checkpoint_required';
  checkpointAccountId?: string;
};

export const EPHEMERAL_UNIPILE_ACCOUNT_NAME_PREFIX = 'ephemeral-wm-';

@Injectable()
export class LinkedinEphemeralUnipileSessionService {
  private readonly logger = new Logger(
    LinkedinEphemeralUnipileSessionService.name,
  );

  private readonly memberLockChains = new Map<string, Promise<void>>();

  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly workspaceMemberLinkedinSearchTypeService: WorkspaceMemberLinkedinSearchTypeService,
  ) {}

  async isEphemeralModeEnabled(workspaceId: string): Promise<boolean> {
    try {
      return await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IsUnipileConnectionDisconnectionEnabled,
        workspaceId,
      );
    } catch {
      return false;
    }
  }

  async shouldUseEphemeralSession(
    workspaceId: string,
    workspaceMemberId: string,
    authToken: string,
  ): Promise<boolean> {
    const flagEnabled = await this.isEphemeralModeEnabled(workspaceId);
    if (!flagEnabled) {
      return false;
    }
    const keepConnected =
      await this.workspaceMemberProfileUnipileService.getKeepLinkedinConnected(
        workspaceMemberId,
        authToken,
      );
    return !keepConnected;
  }

  pickCookieTokenForSearchType(
    searchType: LinkedinEphemeralSearchType,
    liAt?: string | null,
    liA?: string | null,
  ): string | null {
    const liAtToken = liAt?.trim() || null;
    const liAToken = liA?.trim() || null;
    if (searchType === 'sales_navigator') {
      return liAToken ?? liAtToken;
    }
    return liAtToken ?? liAToken;
  }

  hasRequiredCookiesForSearchType(
    searchType: LinkedinEphemeralSearchType,
    liAt?: string | null,
    liA?: string | null,
  ): boolean {
    return this.pickCookieTokenForSearchType(searchType, liAt, liA) !== null;
  }

  async runWithEphemeralSessionIfNeeded<T>(params: {
    workspaceId: string;
    workspaceMemberId: string;
    authToken: string;
    searchType: LinkedinEphemeralSearchType;
    userAgent?: string;
    operationContext: LinkedinEphemeralOperationContext;
    operationDetail?: string;
    operation: (ephemeralAccountId?: string) => Promise<T>;
  }): Promise<T> {
    const useEphemeral = await this.shouldUseEphemeralSession(
      params.workspaceId,
      params.workspaceMemberId,
      params.authToken,
    );
    if (!useEphemeral) {
      return params.operation(undefined);
    }
    return this.withEphemeralLinkedinSession({
      workspaceId: params.workspaceId,
      workspaceMemberId: params.workspaceMemberId,
      authToken: params.authToken,
      searchType: params.searchType,
      userAgent: params.userAgent,
      operationContext: params.operationContext,
      operationDetail: params.operationDetail,
      operation: (accountId) => params.operation(accountId),
    });
  }

  async withEphemeralLinkedinSession<T>(params: {
    workspaceId: string;
    workspaceMemberId: string;
    authToken: string;
    searchType: LinkedinEphemeralSearchType;
    userAgent?: string;
    operationContext: LinkedinEphemeralOperationContext;
    operationDetail?: string;
    operation: (accountId: string) => Promise<T>;
  }): Promise<T> {
    const lockKey = `${params.workspaceId}:${params.workspaceMemberId}`;
    return this.withMemberMutex(lockKey, async () => {
      const sessionStartedAt = Date.now();
      this.logger.log(
        `[ephemeral] session starting context=${params.operationContext} ` +
          `workspaceId=${params.workspaceId} workspaceMemberId=${params.workspaceMemberId} ` +
          `searchType=${params.searchType}` +
          (params.operationDetail ? ` detail=${params.operationDetail}` : ''),
      );

      const connectResult = await this.connectFromStoredCookies({
        workspaceId: params.workspaceId,
        workspaceMemberId: params.workspaceMemberId,
        authToken: params.authToken,
        searchType: params.searchType,
        userAgent: params.userAgent,
        operationContext: params.operationContext,
      });

      if (connectResult.status === 'checkpoint_required') {
        throw new HttpException(
          {
            message:
              'LinkedIn checkpoint required. Complete verification in LinkedIn and retry.',
            account_id: connectResult.checkpointAccountId,
            code: 'linkedin_checkpoint_required',
          },
          HttpStatus.CONFLICT,
        );
      }

      const accountId = connectResult.accountId;
      this.logger.log(
        `[ephemeral] connection started context=${params.operationContext} ` +
          `workspaceId=${params.workspaceId} workspaceMemberId=${params.workspaceMemberId} ` +
          `accountId=${accountId} searchType=${params.searchType}` +
          (params.operationDetail ? ` detail=${params.operationDetail}` : ''),
      );

      await this.workspaceMemberLinkedinSearchTypeService.inferAndPersistFromAccountId(
        params.workspaceMemberId,
        params.authToken,
        accountId,
      );

      let operationError: unknown;
      try {
        return await params.operation(accountId);
      } catch (error) {
        operationError = error;
        throw error;
      } finally {
        const elapsedMs = Date.now() - sessionStartedAt;
        const operationOutcome =
          operationError === undefined ? 'success' : 'error';
        this.logger.log(
          `[ephemeral] connection ending context=${params.operationContext} ` +
            `workspaceId=${params.workspaceId} workspaceMemberId=${params.workspaceMemberId} ` +
            `accountId=${accountId} searchType=${params.searchType} ` +
            `outcome=${operationOutcome} elapsedMs=${elapsedMs}` +
            (params.operationDetail ? ` detail=${params.operationDetail}` : ''),
        );
        await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
          accountId,
          `ephemeral session for member ${params.workspaceMemberId} (${params.operationContext})`,
        );
        this.logger.log(
          `[ephemeral] session ended context=${params.operationContext} ` +
            `workspaceId=${params.workspaceId} workspaceMemberId=${params.workspaceMemberId} ` +
            `accountId=${accountId} outcome=${operationOutcome} elapsedMs=${elapsedMs}` +
            (params.operationDetail ? ` detail=${params.operationDetail}` : ''),
        );
      }
    });
  }

  async disconnectOrphanEphemeralAccounts(): Promise<number> {
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();
    let disconnected = 0;
    for (const account of accounts) {
      const name = typeof account.name === 'string' ? account.name.trim() : '';
      if (!name.startsWith(EPHEMERAL_UNIPILE_ACCOUNT_NAME_PREFIX)) {
        continue;
      }
      const accountId = account.id?.trim();
      if (!accountId) {
        continue;
      }
      await this.linkedinUnipileRequestService.disconnectAccountBestEffort(
        accountId,
        'orphan ephemeral account cleanup',
      );
      disconnected += 1;
    }
    if (disconnected > 0) {
      this.logger.log(
        `Disconnected ${disconnected} orphan ephemeral LinkedIn Unipile account(s)`,
      );
    }
    return disconnected;
  }

  private async connectFromStoredCookies(params: {
    workspaceId: string;
    workspaceMemberId: string;
    authToken: string;
    searchType: LinkedinEphemeralSearchType;
    userAgent?: string;
    operationContext?: LinkedinEphemeralOperationContext;
  }): Promise<EphemeralConnectResult> {
    const stored =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinCookieTokens(
        params.workspaceId,
        params.workspaceMemberId,
      );

    const accessToken = this.pickCookieTokenForSearchType(
      params.searchType,
      stored.linkedinLiAtToken,
      stored.linkedinLiAToken,
    );

    if (!accessToken) {
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieHealth(
        params.workspaceMemberId,
        params.authToken,
        {
          linkedinCookieState: 'missing',
          linkedinCookieActionRequired: true,
          linkedinCookieActionReason:
            params.searchType === 'sales_navigator'
              ? 'sales_nav_cookie_missing'
              : 'cookies_missing',
          linkedinCookieLastValidatedAt: new Date().toISOString(),
          linkedinCookieLastValidationError: 'cookies_missing',
        },
      );
      throw new HttpException(
        {
          message:
            'LinkedIn cookies are missing. Open LinkedIn, sign in, and retry.',
          code: 'linkedin_cookies_missing',
        },
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const ephemeralTag = `${EPHEMERAL_UNIPILE_ACCOUNT_NAME_PREFIX}${params.workspaceMemberId}`;

    this.logger.log(
      `[ephemeral] connecting to Unipile context=${params.operationContext ?? 'unknown'} ` +
        `workspaceMemberId=${params.workspaceMemberId} searchType=${params.searchType} ` +
        `hasLiAt=${Boolean(stored.linkedinLiAtToken)} hasLiA=${Boolean(stored.linkedinLiAToken)}`,
    );

    try {
      const result = (await this.linkedinUnipileRequestService.makeUnipileRequest(
        '/api/v1/accounts',
        'POST',
        {
          provider: 'LINKEDIN',
          access_token: accessToken,
          ...(params.userAgent?.trim() && {
            user_agent: params.userAgent.trim(),
          }),
          name: ephemeralTag,
        },
        { returnStatus: true },
      )) as {
        status: number;
        data: Record<string, unknown> & {
          id?: string;
          account_id?: string;
          object?: string;
          checkpoint?: { type?: string };
        };
      };

      const { status, data } = result;
      const accountId = String(data?.id || data?.account_id || '');
      const isCheckpoint =
        (status === 202 && data?.account_id) ||
        (data?.object === 'Checkpoint' && data?.account_id);

      if (isCheckpoint) {
        await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieHealth(
          params.workspaceMemberId,
          params.authToken,
          {
            linkedinCookieState: 'checkpoint_required',
            linkedinCookieActionRequired: true,
            linkedinCookieActionReason: 'linkedin_checkpoint',
            linkedinCookieLastValidatedAt: new Date().toISOString(),
            linkedinCookieLastValidationError: 'checkpoint_required',
          },
        );
        return {
          accountId: accountId || String(data.account_id),
          status: 'checkpoint_required',
          checkpointAccountId: String(data.account_id || accountId),
        };
      }

      if (!accountId) {
        throw new Error('Unipile connect returned no account id');
      }

      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieHealth(
        params.workspaceMemberId,
        params.authToken,
        {
          linkedinCookieState: 'ready',
          linkedinCookieActionRequired: false,
          linkedinCookieActionReason: null,
          linkedinCookieLastValidatedAt: new Date().toISOString(),
          linkedinCookieLastValidationError: null,
        },
      );

      this.logger.log(
        `[ephemeral] Unipile connect succeeded context=${params.operationContext ?? 'unknown'} ` +
          `workspaceMemberId=${params.workspaceMemberId} accountId=${accountId} searchType=${params.searchType}`,
      );

      return { accountId, status: 'connected' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberLinkedinCookieHealth(
        params.workspaceMemberId,
        params.authToken,
        {
          linkedinCookieState: 'invalid_or_expired',
          linkedinCookieActionRequired: true,
          linkedinCookieActionReason: 'linkedin_signed_out',
          linkedinCookieLastValidatedAt: new Date().toISOString(),
          linkedinCookieLastValidationError: message,
        },
      );
      throw error;
    }
  }

  private async withMemberMutex<T>(
    key: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const previous = this.memberLockChains.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => gate);
    this.memberLockChains.set(key, chain);
    try {
      await previous;
      return await fn();
    } finally {
      release();
      if (this.memberLockChains.get(key) === chain) {
        this.memberLockChains.delete(key);
      }
    }
  }
}
