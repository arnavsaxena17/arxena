import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import {
  LinkedinUnipileEstimateAccountMode,
  parseLinkedinUnipileEstimateAccountMode,
} from '../enums/linkedin-unipile-estimate-account-mode.enum';
import { invalidateUnipileAccountsListCache } from '../utils/unipile-accounts-list.cache';
import { isUnipileLinkedinAccountUnusableError } from '../utils/is-unipile-linkedin-account-unusable-error.util';
import { LinkedinUnipileRequestService } from './linkedin-unipile-request.service';
import {
  LinkedinSessionHandle,
  LinkedinUnipileSessionService,
} from './linkedin-unipile-session.service';

type SalesNavigatorPoolCache = {
  accountIds: string[];
  expiresAt: number;
};

@Injectable()
export class LinkedinUnipileEstimateAccountService {
  private readonly logger = new Logger(LinkedinUnipileEstimateAccountService.name);
  private salesNavigatorPoolCache: SalesNavigatorPoolCache | null = null;
  private static readonly SALES_NAVIGATOR_POOL_CACHE_TTL_MS = 5 * 60_000;
  private static readonly POOL_MAX_RETRY_ATTEMPTS = 3;

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
  ) {}

  getEstimateAccountMode(): LinkedinUnipileEstimateAccountMode {
    return parseLinkedinUnipileEstimateAccountMode(
      this.environmentService.get('LINKEDIN_UNIPILE_ESTIMATE_ACCOUNT_MODE'),
    );
  }

  getOutreachAccountMode(): LinkedinUnipileEstimateAccountMode {
    return parseLinkedinUnipileEstimateAccountMode(
      this.environmentService.get('LINKEDIN_UNIPILE_OUTREACH_ACCOUNT_MODE'),
    );
  }

  isSharedSalesNavigatorPoolMode(
    mode: LinkedinUnipileEstimateAccountMode,
  ): boolean {
    return mode === LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool;
  }

  /**
   * Resolves which Unipile LinkedIn account to use for org-chart / super-impose estimates only.
   * Does not affect search execution or candidate fetch pipelines.
   */
  async withEstimateLinkedinSession<T>(
    apiToken: string,
    clientAccountId: string | undefined,
    run: (session: LinkedinSessionHandle) => Promise<T>,
  ): Promise<T> {
    return this.withPooledLinkedinSession(
      this.getEstimateAccountMode(),
      apiToken,
      clientAccountId,
      'Org-chart estimate',
      run,
    );
  }

  /**
   * Runs outreach generation with estimate/outreach account mode resolution and pool retry.
   */
  async withOutreachLinkedinSession<T>(
    apiToken: string,
    clientAccountId: string | undefined,
    run: (session: LinkedinSessionHandle) => Promise<T>,
  ): Promise<T> {
    return this.withPooledLinkedinSession(
      this.getOutreachAccountMode(),
      apiToken,
      clientAccountId,
      'Org-chart outreach',
      run,
    );
  }

  async resolveEstimateAccountId(
    clientAccountId?: string,
  ): Promise<string | undefined> {
    return this.resolveAccountIdForMode(
      this.getEstimateAccountMode(),
      clientAccountId,
      'Org-chart estimate',
    );
  }

  /**
   * Resolves which Unipile LinkedIn account to use for outreach message generation.
   * Default mode uses the shared Sales Navigator pool instead of on-demand member cookie reconnect.
   */
  async resolveOutreachAccountId(
    clientAccountId?: string,
  ): Promise<string | undefined> {
    return this.resolveAccountIdForMode(
      this.getOutreachAccountMode(),
      clientAccountId,
      'Org-chart outreach',
    );
  }

  private async withPooledLinkedinSession<T>(
    mode: LinkedinUnipileEstimateAccountMode,
    apiToken: string,
    clientAccountId: string | undefined,
    logPrefix: string,
    run: (session: LinkedinSessionHandle) => Promise<T>,
  ): Promise<T> {
    if (!this.isSharedSalesNavigatorPoolMode(mode)) {
      const accountId = await this.resolveAccountIdForMode(
        mode,
        clientAccountId,
        logPrefix,
      );

      return this.linkedinUnipileSessionService.withLinkedinSession(
        apiToken,
        accountId,
        run,
      );
    }

    const excludedAccountIds = new Set<string>();

    for (
      let attempt = 0;
      attempt < LinkedinUnipileEstimateAccountService.POOL_MAX_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      const candidates = await this.getPoolCandidatesExcluding(excludedAccountIds);
      if (candidates.length === 0) {
        break;
      }

      const accountId = this.pickRandomFromCandidates(candidates);
      this.logger.log(
        `${logPrefix} using shared Sales Navigator pool account ${accountId} attempt=${attempt + 1}`,
      );

      try {
        return await this.linkedinUnipileSessionService.withLinkedinSession(
          apiToken,
          accountId,
          run,
        );
      } catch (error) {
        if (!isUnipileLinkedinAccountUnusableError(error)) {
          throw error;
        }

        this.logger.warn(
          `${logPrefix} shared Sales Navigator pool account ${accountId} unusable, trying another: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        excludedAccountIds.add(accountId);
        this.excludePoolAccountId(accountId);
        invalidateUnipileAccountsListCache();
      }
    }

    throw new Error(
      'All shared Sales Navigator pool LinkedIn Unipile accounts failed or are unavailable',
    );
  }

  private async resolveAccountIdForMode(
    mode: LinkedinUnipileEstimateAccountMode,
    clientAccountId: string | undefined,
    logPrefix: string,
  ): Promise<string | undefined> {
    if (mode === LinkedinUnipileEstimateAccountMode.EnvAccountId) {
      const envAccountId = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID?.trim();
      if (!envAccountId) {
        throw new Error(
          `${logPrefix} requires UNIPILE_LINKEDIN_ACCOUNT_ID when account mode is env_account_id`,
        );
      }
      this.logger.log(
        `${logPrefix} using env LinkedIn Unipile account ${envAccountId}`,
      );
      return envAccountId;
    }

    if (mode === LinkedinUnipileEstimateAccountMode.SharedSalesNavigatorPool) {
      const poolAccountId = await this.pickRandomSalesNavigatorAccountId();
      this.logger.log(
        `${logPrefix} using shared Sales Navigator pool account ${poolAccountId}`,
      );
      return poolAccountId;
    }

    return clientAccountId?.trim() || undefined;
  }

  private async getPoolCandidatesExcluding(
    excludedAccountIds: ReadonlySet<string>,
  ): Promise<string[]> {
    let candidates = (await this.getCachedSalesNavigatorAccountIds()).filter(
      (accountId) => !excludedAccountIds.has(accountId),
    );

    if (candidates.length > 0) {
      return candidates;
    }

    this.invalidateSalesNavigatorPoolCache();
    candidates = (await this.getCachedSalesNavigatorAccountIds()).filter(
      (accountId) => !excludedAccountIds.has(accountId),
    );

    return candidates;
  }

  private pickRandomFromCandidates(candidates: string[]): string {
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index]!;
  }

  private async pickRandomSalesNavigatorAccountId(): Promise<string> {
    const accountIds = await this.getCachedSalesNavigatorAccountIds();
    if (accountIds.length === 0) {
      throw new Error(
        'No connected Sales Navigator LinkedIn Unipile accounts available for estimate pool',
      );
    }

    return this.pickRandomFromCandidates(accountIds);
  }

  private excludePoolAccountId(accountId: string): void {
    const trimmed = accountId.trim();
    if (!trimmed || !this.salesNavigatorPoolCache) {
      return;
    }

    this.salesNavigatorPoolCache = {
      ...this.salesNavigatorPoolCache,
      accountIds: this.salesNavigatorPoolCache.accountIds.filter(
        (cachedAccountId) => cachedAccountId !== trimmed,
      ),
    };
  }

  private invalidateSalesNavigatorPoolCache(): void {
    this.salesNavigatorPoolCache = null;
  }

  private async getCachedSalesNavigatorAccountIds(): Promise<string[]> {
    const cached = this.salesNavigatorPoolCache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accountIds;
    }

    const accountIds = await this.loadSalesNavigatorAccountIdsFromUnipile();
    this.salesNavigatorPoolCache = {
      accountIds,
      expiresAt:
        Date.now() +
        LinkedinUnipileEstimateAccountService.SALES_NAVIGATOR_POOL_CACHE_TTL_MS,
    };

    this.logger.log(
      `Cached ${accountIds.length} Sales Navigator LinkedIn Unipile account(s) for org-chart estimates`,
    );

    return accountIds;
  }

  private async loadSalesNavigatorAccountIdsFromUnipile(): Promise<string[]> {
    const { accounts } =
      await this.linkedinUnipileRequestService.listAllLinkedinAccountsFromUnipileApi();

    const connectedAccountIds = accounts
      .filter((account) => account.status === 'connected' && account.id?.trim())
      .map((account) => account.id!.trim());

    const salesNavigatorAccountIds: string[] = [];

    await Promise.all(
      connectedAccountIds.map(async (accountId) => {
        const capabilities =
          await this.linkedinUnipileRequestService.inferLinkedinSearchTypeForAccount(
            accountId,
          );
        if (capabilities?.salesNavigatorAvailable) {
          salesNavigatorAccountIds.push(accountId);
        }
      }),
    );

    if (salesNavigatorAccountIds.length > 0) {
      return salesNavigatorAccountIds;
    }

    this.logger.warn(
      `No Sales Navigator accounts found among ${connectedAccountIds.length} connected LinkedIn Unipile account(s); falling back to connected accounts for estimates`,
    );

    return connectedAccountIds;
  }
}
