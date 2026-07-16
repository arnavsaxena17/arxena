import { forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
  hasWorkspaceMemberLinkedinFullProfile,
  hasWorkspaceMemberLinkedinOwnerProfile,
  inferLinkedInSearchTypeFromUnipileOwnerProfile,
  workspaceMemberLinkedinProfileMatchesAccountId,
  type UnipileAccountOwnerProfile,
} from 'twenty-shared';

import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

import { UnipileLinkedinAccountUnusableError } from '../errors/unipile-linkedin-account-unusable.error';
import type {
  LinkedinSenderFullProfileCacheEntry,
  LinkedinSenderFullProfileResult,
} from '../types/linkedin-sender-profile-cache.types';
import { LinkedinUnipileAccountCleanupContext } from '../types/linkedin-unipile-account-cleanup.types';
import { isUnipileLinkedinAccountUnusableError } from '../utils/is-unipile-linkedin-account-unusable-error.util';
import {
  fetchUnipileAccountsListWithCache,
  invalidateUnipileAccountsListCache,
  removeAccountFromUnipileAccountsListCache,
  seedUnipileAccountsListCache,
  shouldInvalidateUnipileAccountsListCache,
} from '../utils/unipile-accounts-list.cache';
import {
  isUnipileAccountNotFoundApiError,
  isUnipileDisconnectedAccountApiError,
  parseAccountIdFromUnipileEndpoint,
} from '../utils/unipile-disconnected-account.util';
import {
  getSnapshotLinkedinAccounts,
  getSnapshotOwnerProfile,
  getSnapshotRawAccountById,
  getSnapshotRawAccountsList,
  hasSnapshotOwnerProfile,
  isUnipileLinkedinSnapshotFresh,
  patchSnapshotOwnerProfile,
  patchSnapshotRawAccount,
  removeSnapshotAccountById,
  setUnipileLinkedinSnapshot,
  UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
  type UnipileLinkedinSnapshotAccountRow,
  type UnipileLinkedinSnapshotRawAccount,
} from '../utils/unipile-linkedin-snapshot.cache';
import type { MemberLinkedinUnipileConnectionService } from './member-linkedin-unipile-connection.service';
import type { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

const getMemberLinkedinUnipileConnectionService = () =>
  require('./member-linkedin-unipile-connection.service')
    .MemberLinkedinUnipileConnectionService as typeof import('./member-linkedin-unipile-connection.service').MemberLinkedinUnipileConnectionService;

const getWorkspaceMemberProfileUnipileService = () =>
  require('./workspace-member-profile-unipile.service')
    .WorkspaceMemberProfileUnipileService as typeof import('./workspace-member-profile-unipile.service').WorkspaceMemberProfileUnipileService;

type LinkedinUnipileAccountItem = Record<string, unknown> & {
  id?: string;
  name?: string;
  type?: string;
  created_at?: string;
  connection_params?: {
    im?: { publicIdentifier?: string; status?: string };
    status?: string;
  };
  status?: string;
  sources?: { status?: string }[];
  groups?: unknown[];
};

@Injectable()
export class LinkedinUnipileRequestService {
  private readonly logger = new Logger(LinkedinUnipileRequestService.name);

  private readonly unipileApiUrl = process.env.UNIPILE_API_URL;
  private readonly unipileAccessToken = process.env.UNIPILE_ACCESS_TOKEN;
  private snapshotRefreshInFlight: Promise<void> | null = null;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    @Optional()
    @Inject(forwardRef(getMemberLinkedinUnipileConnectionService))
    private readonly memberLinkedinUnipileConnectionService?: MemberLinkedinUnipileConnectionService,
    @Optional()
    @Inject(forwardRef(getWorkspaceMemberProfileUnipileService))
    private readonly workspaceMemberProfileUnipileService?: WorkspaceMemberProfileUnipileService,
  ) {
    this.logger.log(`Unipile API URL: ${this.unipileApiUrl}`);
    this.logger.log(
      `Unipile Access Token configured: ${!!this.unipileAccessToken}`,
    );
  }

  async makeUnipileRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    options?: {
      returnStatus?: boolean;
      linkedinAccountCleanup?: LinkedinUnipileAccountCleanupContext;
    },
  ): Promise<unknown> {
    const url = `${this.unipileApiUrl}${endpoint}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    try {
      this.logger.log(`Making Unipile request to: ${url}`);
      this.logger.log(
        `Using API key: ${this.unipileAccessToken?.substring(0, 10) || ''}...`,
      );

      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));
      this.logger.log(`Data in MAKE UNIPILE REQUEST: ${JSON.stringify(data, null, 2)}`);
      if (!response.ok) {
        this.logger.error(
          `Unipile API error: ${response.status} ${response.statusText}`,
        );
        this.logger.error(
          `Unipile API error: Object:`,
          JSON.stringify(data, null, 2),
        );

        await this.handleDisconnectedAccountApiErrorIfNeeded(
          response.status,
          data,
          endpoint,
          options?.linkedinAccountCleanup,
        );

        const message =
          (data as { detail?: string; message?: string }).detail ||
          (data as { message?: string }).message ||
          `Unipile API error: ${response.statusText}`;
        throw new HttpException(message, response.status);
      }

      if (shouldInvalidateUnipileAccountsListCache(endpoint, method)) {
        invalidateUnipileAccountsListCache();
      }

      if (options?.returnStatus) {
        return { status: response.status, data };
      }
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Failed to make Unipile request:', error);
      throw new HttpException(
        'Failed to communicate with Unipile API',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async handleDisconnectedAccountApiErrorIfNeeded(
    status: number,
    data: unknown,
    endpoint: string,
    cleanupContext?: LinkedinUnipileAccountCleanupContext,
  ): Promise<void> {
    const isDisconnected = isUnipileDisconnectedAccountApiError(status, data);
    const isNotFound = isUnipileAccountNotFoundApiError(status, data);

    if (!isDisconnected && !isNotFound) {
      return;
    }

    const accountIdFromEndpoint = parseAccountIdFromUnipileEndpoint(endpoint);
    const accountId =
      cleanupContext?.accountId?.trim() || accountIdFromEndpoint?.trim() || '';

    if (!accountId) {
      this.logger.warn(
        `Unipile ${isNotFound ? 'account_not_found' : 'disconnected_account'} error without account id endpoint=${endpoint}`,
      );
      return;
    }

    if (cleanupContext?.isSharedPoolAccount) {
      this.logger.warn(
        `Unipile ${isNotFound ? 'account_not_found' : 'disconnected_account'} for shared pool accountId=${accountId}; skipping workspace member profile cleanup context=${cleanupContext.context}`,
      );
      return;
    }

    if (cleanupContext) {
      this.clearLinkedinUnipileAccountFromCaches(accountId);

      if (isNotFound) {
        await this.memberLinkedinUnipileConnectionService?.cleanupStoredLinkedinAccountAfterNotFoundApiError(
          {
            ...cleanupContext,
            accountId,
          },
        );
      } else {
        await this.memberLinkedinUnipileConnectionService?.cleanupStoredLinkedinAccountAfterDisconnectedApiError(
          {
            ...cleanupContext,
            accountId,
          },
        );
      }
      return;
    }

    this.clearLinkedinUnipileAccountFromCaches(accountId);

    this.logger.warn(
      `Unipile ${isNotFound ? 'account_not_found' : 'disconnected_account'} for accountId=${accountId} without workspace member cleanup context`,
    );
  }

  clearLinkedinUnipileAccountFromCaches(accountId: string): void {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return;
    }

    const removedFromSnapshot = removeSnapshotAccountById(trimmed);
    const removedFromList = removeAccountFromUnipileAccountsListCache(trimmed);

    if (removedFromSnapshot || removedFromList) {
      this.logger.log(
        `Cleared stale LinkedIn Unipile account caches accountId=${trimmed} snapshot=${removedFromSnapshot} accountsList=${removedFromList}`,
      );
    }
  }

  /** Fetch a single account by id; returns null on 404 (e.g. account disconnected) without logging ERROR. */
  async fetchAccountByIdIfExists(
    accountId: string,
    options?: { bypassSnapshot?: boolean },
  ): Promise<LinkedinUnipileAccountItem | null> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return null;
    }

    if (options?.bypassSnapshot !== true) {
      await this.ensureLinkedinSnapshotFresh();
      const snapshotAccount = getSnapshotRawAccountById(trimmed);
      if (snapshotAccount !== undefined) {
        return snapshotAccount as LinkedinUnipileAccountItem | null;
      }
    }

    const url = `${this.unipileApiUrl}/api/v1/accounts/${trimmed}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
    };
    try {
      const response = await fetch(url, { method: 'GET', headers });
      const data = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (response.status === 404) {
        this.logger.warn(
          `Workspace linked account ${trimmed} not found in Unipile (404); it may have been disconnected`,
        );
        invalidateUnipileAccountsListCache();
        return null;
      }
      if (!response.ok) {
        this.logger.error(
          `Unipile API error: ${response.status} ${response.statusText}`,
          data,
        );
        return null;
      }
      patchSnapshotRawAccount(data as UnipileLinkedinSnapshotRawAccount);
      return data as LinkedinUnipileAccountItem;
    } catch (err) {
      this.logger.warn(
        `Could not fetch account ${trimmed}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async ensureLinkedinSnapshotFresh(): Promise<void> {
    if (isUnipileLinkedinSnapshotFresh()) {
      return;
    }

    await this.refreshLinkedinSnapshotFromApi({ trigger: 'lazy-refresh' });
  }

  async refreshLinkedinSnapshotFromApi(options?: {
    force?: boolean;
    trigger?: string;
  }): Promise<void> {
    if (options?.force !== true && isUnipileLinkedinSnapshotFresh()) {
      return;
    }

    if (this.snapshotRefreshInFlight) {
      return this.snapshotRefreshInFlight;
    }

    this.snapshotRefreshInFlight = this.buildLinkedinSnapshotFromUnipileApi(
      options?.trigger?.trim() || 'manual',
    ).finally(() => {
      this.snapshotRefreshInFlight = null;
    });

    return this.snapshotRefreshInFlight;
  }

  private async buildLinkedinSnapshotFromUnipileApi(
    trigger: string,
  ): Promise<void> {
    this.logger.log(
      `Refreshing Unipile LinkedIn server snapshot (trigger=${trigger})`,
    );

    const response = (await this.makeUnipileRequest('/api/v1/accounts')) as {
      items?: LinkedinUnipileAccountItem[];
    };

    const rawAccountsList = {
      items: (response.items ?? []) as UnipileLinkedinSnapshotRawAccount[],
    };
    const linkedinAccounts = (response.items ?? [])
      .filter((item) => String(item.type ?? '').toUpperCase() === 'LINKEDIN')
      .map((item) => this.mapLinkedinApiItemToAccountRow(item));

    const ownerProfilesByAccountId = new Map<
      string,
      UnipileAccountOwnerProfile | null
    >();

    const connectedAccountIds = linkedinAccounts
      .filter((account) => account.status === 'connected' && account.id?.trim())
      .map((account) => account.id!.trim());

    await Promise.all(
      connectedAccountIds.map(async (connectedAccountId) => {
        ownerProfilesByAccountId.set(
          connectedAccountId,
          await this.fetchLinkedinOwnerProfileFromApiUncached(connectedAccountId),
        );
      }),
    );

    setUnipileLinkedinSnapshot({
      rawAccountsList,
      linkedinAccounts:
        linkedinAccounts as UnipileLinkedinSnapshotAccountRow[],
      ownerProfilesByAccountId,
    });
    seedUnipileAccountsListCache(
      rawAccountsList,
      UNIPILE_LINKEDIN_SNAPSHOT_TTL_MS,
    );

    this.logger.log(
      `Cached Unipile LinkedIn snapshot: ${linkedinAccounts.length} LinkedIn account(s), ${ownerProfilesByAccountId.size} owner profile(s) (trigger=${trigger})`,
    );
  }

  private async fetchLinkedinOwnerProfileFromApiUncached(
    accountId: string,
  ): Promise<UnipileAccountOwnerProfile | null> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const response = (await this.makeUnipileRequest(
        `/api/v1/users/me?account_id=${encodeURIComponent(trimmed)}`,
        'GET',
      )) as UnipileAccountOwnerProfile;

      return response ?? null;
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinOwnerProfileFromApiUncached failed for ${trimmed}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  mapAccountStatus(
    account: LinkedinUnipileAccountItem,
  ): 'connected' | 'disconnected' | 'pending' | 'checkpoint_required' {
    const rawStatus =
      account?.connection_params?.status ??
      account?.status ??
      account?.connection_params?.im?.status ??
      account?.sources?.[0]?.status;

    if (typeof rawStatus === 'string') {
      const status = rawStatus.toLowerCase();

      if (['active', 'ok', 'connected', 'ready', 'synced'].includes(status)) {
        return 'connected';
      }

      if (
        ['credentials', 'failed', 'error', 'disconnected', 'revoked'].includes(
          status,
        )
      ) {
        return 'disconnected';
      }

      if (status === 'checkpoint_required') {
        return 'checkpoint_required';
      }

      if (
        status === 'pending' ||
        status === 'syncing' ||
        status === 'connecting'
      ) {
        return 'pending';
      }

      return 'disconnected';
    }

    return account?.id ? 'connected' : 'disconnected';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Poll Unipile until the LinkedIn account leaves CONNECTING/syncing, or timeout.
   */
  async waitForLinkedinAccountConnectReady(
    accountId: string,
    options?: { timeoutMs?: number; pollIntervalMs?: number },
  ): Promise<{
    status: 'connected' | 'disconnected' | 'pending' | 'checkpoint_required';
    timedOut: boolean;
  }> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return { status: 'disconnected', timedOut: false };
    }

    const timeoutMs = options?.timeoutMs ?? 90_000;
    const pollIntervalMs = options?.pollIntervalMs ?? 3_000;
    const deadline = Date.now() + timeoutMs;

    const readStatus = async (): Promise<
      'connected' | 'disconnected' | 'pending' | 'checkpoint_required'
    > => {
      const account = await this.fetchAccountByIdIfExists(trimmed, {
        bypassSnapshot: true,
      });
      if (!account) {
        return 'disconnected';
      }

      return this.mapAccountStatus(account);
    };

    while (Date.now() < deadline) {
      const status = await readStatus();
      if (
        status === 'connected' ||
        status === 'checkpoint_required' ||
        status === 'disconnected'
      ) {
        return { status, timedOut: false };
      }

      await this.delay(pollIntervalMs);
    }

    const finalStatus = await readStatus();
    if (finalStatus === 'connected' || finalStatus === 'checkpoint_required') {
      return { status: finalStatus, timedOut: false };
    }
    if (finalStatus === 'disconnected') {
      return { status: 'disconnected', timedOut: true };
    }

    return { status: 'pending', timedOut: true };
  }

  /**
   * Normalizes a raw LinkedIn account payload from Unipile (list item or GET by id).
   */
  mapLinkedinApiItemToAccountRow(item: LinkedinUnipileAccountItem) {
    const publicIdentifier =
      item.connection_params?.im?.publicIdentifier?.trim() ?? '';
    const displayUsername =
      publicIdentifier !== '' ? publicIdentifier : item.name || 'Unknown';
    return {
      id: item.id,
      username: displayUsername,
      name: item.name || 'Unknown',
      type: item.type,
      status: this.mapAccountStatus(item),
      created_at: item.created_at,
      provider: 'LINKEDIN' as const,
      connection_params: item.connection_params,
      sources: item.sources || [],
      groups: item.groups || [],
    };
  }

  /**
   * Raw Unipile account list (all providers). Cached process-wide because the list is
   * global to the Unipile DSN, not scoped to a workspace.
   */
  async fetchRawUnipileAccountsListCached(): Promise<{
    items?: LinkedinUnipileAccountItem[];
  }> {
    const snapshotRaw = getSnapshotRawAccountsList();
    if (snapshotRaw) {
      return snapshotRaw as { items?: LinkedinUnipileAccountItem[] };
    }

    return fetchUnipileAccountsListWithCache(async () => {
      this.logger.log(
        'Fetching Unipile account list from API (cache miss or expired)',
      );
      return (await this.makeUnipileRequest('/api/v1/accounts')) as {
        items?: LinkedinUnipileAccountItem[];
      };
    });
  }

  /**
   * All LinkedIn accounts from Unipile. Fetches the full account list and filters by
   * `type === 'LINKEDIN'` (the `?provider=linkedin` query can return an empty list on some DSNs).
   */
  async listAllLinkedinAccountsFromUnipileApi() {
    await this.ensureLinkedinSnapshotFresh();
    const snapshotAccounts = getSnapshotLinkedinAccounts();
    if (snapshotAccounts) {
      this.logger.log(
        `Unipile LinkedIn API: ${snapshotAccounts.length} account(s) (server snapshot)`,
      );
      return { success: true as const, accounts: snapshotAccounts };
    }

    const response = await this.fetchRawUnipileAccountsListCached();

    const accounts = (response.items || [])
      .filter((item) => String(item.type ?? '').toUpperCase() === 'LINKEDIN')
      .map((item) => this.mapLinkedinApiItemToAccountRow(item));

    this.logger.log(
      `Unipile LinkedIn API: ${accounts.length} account(s) (filtered from full list)`,
    );

    return { success: true as const, accounts };
  }

  async inferLinkedinSearchTypeForAccount(accountId: string): Promise<{
    inferredSearchType: 'classic' | 'sales_navigator' | 'recruiter';
    salesNavigatorAvailable: boolean;
    recruiterAvailable: boolean;
  } | null> {
    const profile = await this.fetchLinkedinOwnerProfile(accountId);
    if (!profile) {
      return null;
    }
    return {
      inferredSearchType:
        inferLinkedInSearchTypeFromUnipileOwnerProfile(profile),
      salesNavigatorAvailable: profile.sales_navigator != null,
      recruiterAvailable: profile.recruiter != null,
    };
  }

  async fetchLinkedinOwnerProfile(
    accountId: string,
    cleanupContext?: LinkedinUnipileAccountCleanupContext,
    options?: { refresh?: boolean },
  ): Promise<UnipileAccountOwnerProfile | null> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return null;
    }

    const workspaceMemberId = cleanupContext?.workspaceMemberId?.trim() ?? '';
    const authToken = cleanupContext?.authToken?.trim() ?? '';

    if (
      workspaceMemberId &&
      authToken &&
      this.workspaceMemberProfileUnipileService &&
      options?.refresh !== true
    ) {
      const stored =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinProfile(
          workspaceMemberId,
          authToken,
        );

      if (
        stored &&
        hasWorkspaceMemberLinkedinOwnerProfile(stored) &&
        workspaceMemberLinkedinProfileMatchesAccountId(stored, trimmed)
      ) {
        this.logger.log(
          `LinkedIn owner profile loaded from workspace member profile for accountId=${trimmed}`,
        );
        return stored.me;
      }
    }

    if (options?.refresh !== true && !cleanupContext) {
      await this.ensureLinkedinSnapshotFresh();
      if (hasSnapshotOwnerProfile(trimmed)) {
        const cachedProfile = getSnapshotOwnerProfile(trimmed);
        this.logger.log(
          `LinkedIn owner profile loaded from server snapshot for accountId=${trimmed}`,
        );
        return cachedProfile ?? null;
      }
    }

    try {
      const response = (await this.makeUnipileRequest(
        `/api/v1/users/me?account_id=${encodeURIComponent(trimmed)}`,
        'GET',
        undefined,
        {
          linkedinAccountCleanup: cleanupContext
            ? { ...cleanupContext, accountId: trimmed }
            : undefined,
        },
      )) as UnipileAccountOwnerProfile & { public_identifier?: string };

      if (response && workspaceMemberId && authToken && this.workspaceMemberProfileUnipileService) {
        const publicIdentifier =
          typeof response.public_identifier === 'string'
            ? response.public_identifier.trim()
            : undefined;

        await this.workspaceMemberProfileUnipileService.saveWorkspaceMemberLinkedinProfile(
          workspaceMemberId,
          authToken,
          {
            linkedinUnipileAccountId: trimmed,
            me: response,
            ...(publicIdentifier ? { publicIdentifier } : {}),
            fetchedAt: new Date().toISOString(),
          },
        );
      }

      if (!cleanupContext) {
        patchSnapshotOwnerProfile(trimmed, response ?? null);
      }

      return response ?? null;
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinOwnerProfile failed for ${trimmed}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private toSenderFullProfileEntry(
    stored: NonNullable<
      Awaited<
        ReturnType<
          WorkspaceMemberProfileUnipileService['getWorkspaceMemberLinkedinProfile']
        >
      >
    >,
    accountId: string,
  ): LinkedinSenderFullProfileCacheEntry | null {
    if (!hasWorkspaceMemberLinkedinFullProfile(stored)) {
      return null;
    }

    if (!workspaceMemberLinkedinProfileMatchesAccountId(stored, accountId)) {
      return null;
    }

    return {
      me: stored.me,
      fullProfile: stored.fullProfile,
      publicIdentifier: stored.publicIdentifier.trim(),
      fetchedAt: stored.fetchedAt,
      linkedinUnipileAccountId: stored.linkedinUnipileAccountId,
    };
  }

  async fetchLinkedinSenderFullProfile(
    accountId: string,
    options?: {
      cleanupContext?: LinkedinUnipileAccountCleanupContext;
      refresh?: boolean;
    },
  ): Promise<LinkedinSenderFullProfileResult | null> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return null;
    }

    const workspaceMemberId =
      options?.cleanupContext?.workspaceMemberId?.trim() ?? '';
    const authToken = options?.cleanupContext?.authToken?.trim() ?? '';

    if (
      !options?.refresh &&
      workspaceMemberId &&
      authToken &&
      this.workspaceMemberProfileUnipileService
    ) {
      const stored =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberLinkedinProfile(
          workspaceMemberId,
          authToken,
        );
      const entry = stored ? this.toSenderFullProfileEntry(stored, trimmed) : null;

      if (entry) {
        this.logger.log(
          `LinkedIn sender full profile loaded from workspace member profile for accountId=${trimmed}`,
        );
        return { entry, fromCache: true };
      }
    }

    const me = await this.fetchLinkedinOwnerProfile(
      trimmed,
      options?.cleanupContext,
      { refresh: options?.refresh === true },
    );
    const meWithIdentifier = me as UnipileAccountOwnerProfile & {
      public_identifier?: string;
    };
    if (!meWithIdentifier?.public_identifier?.trim()) {
      this.logger.warn(
        `fetchLinkedinSenderFullProfile: missing public_identifier for accountId=${trimmed}`,
      );
      return null;
    }

    const publicIdentifier = meWithIdentifier.public_identifier.trim();
    const queryParams = new URLSearchParams({
      account_id: trimmed,
      linkedin_sections: '*',
    });

    try {
      const fullProfile = (await this.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(publicIdentifier)}?${queryParams}`,
        'GET',
        undefined,
        {
          linkedinAccountCleanup: options?.cleanupContext
            ? { ...options.cleanupContext, accountId: trimmed }
            : undefined,
        },
      )) as Record<string, unknown>;

      const entry: LinkedinSenderFullProfileCacheEntry = {
        linkedinUnipileAccountId: trimmed,
        me: meWithIdentifier,
        fullProfile,
        publicIdentifier,
        fetchedAt: new Date().toISOString(),
      };

      if (workspaceMemberId && authToken && this.workspaceMemberProfileUnipileService) {
        await this.workspaceMemberProfileUnipileService.saveWorkspaceMemberLinkedinProfile(
          workspaceMemberId,
          authToken,
          entry,
        );
      }

      this.logger.log(
        `LinkedIn sender full profile saved for accountId=${trimmed} publicIdentifier=${publicIdentifier}`,
      );

      return { entry, fromCache: false };
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinSenderFullProfile failed for ${trimmed}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async fetchLinkedinUserProfile(
    accountId: string,
    identifier: string,
    options?: {
      linkedinSections?: string[];
      notify?: boolean;
      cleanupContext?: LinkedinUnipileAccountCleanupContext;
    },
  ): Promise<Record<string, unknown> | null> {
    const trimmedAccountId = accountId.trim();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedAccountId || !trimmedIdentifier) {
      return null;
    }

    const queryParams = new URLSearchParams({
      account_id: trimmedAccountId,
    });
    const sections = options?.linkedinSections ?? ['*'];
    if (sections.length > 0) {
      queryParams.append('linkedin_sections', sections.join(','));
    }
    if (options?.notify !== undefined) {
      queryParams.append('notify', String(options.notify));
    }

    try {
      return (await this.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(trimmedIdentifier)}?${queryParams}`,
        'GET',
        undefined,
        {
          linkedinAccountCleanup: options?.cleanupContext
            ? { ...options.cleanupContext, accountId: trimmedAccountId }
            : undefined,
        },
      )) as Record<string, unknown>;
    } catch (err) {
      if (isUnipileLinkedinAccountUnusableError(err)) {
        this.logger.warn(
          `fetchLinkedinUserProfile unusable LinkedIn Unipile account ${trimmedAccountId} for ${trimmedIdentifier}: ${err instanceof Error ? err.message : err}`,
        );
        if (err instanceof UnipileLinkedinAccountUnusableError) {
          throw err;
        }
        throw new UnipileLinkedinAccountUnusableError(
          `LinkedIn Unipile account ${trimmedAccountId} is unusable`,
          { accountId: trimmedAccountId, cause: err },
        );
      }

      this.logger.warn(
        `fetchLinkedinUserProfile failed for ${trimmedIdentifier}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async fetchLinkedinUserPosts(
    accountId: string,
    identifier: string,
    options?: {
      limit?: number;
      cursor?: string;
      isCompany?: boolean;
      cleanupContext?: LinkedinUnipileAccountCleanupContext;
    },
  ): Promise<Record<string, unknown> | null> {
    const trimmedAccountId = accountId.trim();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedAccountId || !trimmedIdentifier) {
      return null;
    }

    const queryParams = new URLSearchParams({
      account_id: trimmedAccountId,
    });
    if (options?.limit !== undefined) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.cursor) {
      queryParams.append('cursor', options.cursor);
    }
    if (options?.isCompany !== undefined) {
      queryParams.append('is_company', String(options.isCompany));
    }

    try {
      return (await this.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(trimmedIdentifier)}/posts?${queryParams}`,
        'GET',
        undefined,
        {
          linkedinAccountCleanup: options?.cleanupContext
            ? { ...options.cleanupContext, accountId: trimmedAccountId }
            : undefined,
        },
      )) as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinUserPosts failed for ${trimmedIdentifier}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async fetchLinkedinUserComments(
    accountId: string,
    identifier: string,
    options?: {
      limit?: number;
      cursor?: string;
      cleanupContext?: LinkedinUnipileAccountCleanupContext;
    },
  ): Promise<Record<string, unknown> | null> {
    const trimmedAccountId = accountId.trim();
    const trimmedIdentifier = identifier.trim();
    if (!trimmedAccountId || !trimmedIdentifier) {
      return null;
    }

    const queryParams = new URLSearchParams({
      account_id: trimmedAccountId,
    });
    if (options?.limit !== undefined) {
      queryParams.append('limit', String(options.limit));
    }
    if (options?.cursor) {
      queryParams.append('cursor', options.cursor);
    }

    try {
      return (await this.makeUnipileRequest(
        `/api/v1/users/${encodeURIComponent(trimmedIdentifier)}/comments?${queryParams}`,
        'GET',
        undefined,
        {
          linkedinAccountCleanup: options?.cleanupContext
            ? { ...options.cleanupContext, accountId: trimmedAccountId }
            : undefined,
        },
      )) as Record<string, unknown>;
    } catch (err) {
      this.logger.warn(
        `fetchLinkedinUserComments failed for ${trimmedIdentifier}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async getAllAccounts(workspace: Workspace): Promise<{
    success: boolean;
    accounts: LinkedinUnipileAccountItem[];
    message?: string;
  }> {
    try {
      const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(
        workspace.id,
      );
      const linkedinUrl = workspaceKeys.linkedin_url;
      const linkedinUnipileAccountId = workspaceKeys.linkedin_unipile_account_id;

      if (!linkedinUrl && !linkedinUnipileAccountId) {
        this.logger.warn(
          `No linkedin_url or linkedin_unipile_account_id for workspace ${workspace.id}, skipping Unipile accounts call`,
        );
        return {
          success: true,
          accounts: [],
          message: 'linkedin_url not configured for workspace',
        };
      }

      const response = await this.fetchRawUnipileAccountsListCached();
      this.logger.log('Getting getAllAccounts response');

      this.logger.log(
        `Filtering LinkedIn accounts for workspace ${workspace.id} with linkedin_url: ${linkedinUrl ?? 'none'}, linkedin_unipile_account_id: ${linkedinUnipileAccountId ?? 'none'}`,
      );

      const allAccounts = (response.items || [])
        .filter((item) => String(item.type ?? '').toUpperCase() === 'LINKEDIN')
        .map((item) => this.mapLinkedinApiItemToAccountRow(item));

      const accounts = allAccounts.filter((account) => {
        if (linkedinUnipileAccountId && account.id === linkedinUnipileAccountId) {
          this.logger.log(
            `Account ${account.id} matches workspace linkedin_unipile_account_id`,
          );
          return true;
        }

        const accountPublicIdentifier =
          account.connection_params?.im?.publicIdentifier;
        if (!accountPublicIdentifier) {
          this.logger.warn(
            `Account ${account.id} has no publicIdentifier in connection_params`,
          );
          return false;
        }

        if (!linkedinUrl) return false;

        const matches =
          accountPublicIdentifier === linkedinUrl ||
          linkedinUrl.includes(accountPublicIdentifier) ||
          accountPublicIdentifier.includes(linkedinUrl);

        if (matches) {
          this.logger.log(
            `Account ${account.id} (${accountPublicIdentifier}) matches linkedin_url: ${linkedinUrl}`,
          );
        } else {
          this.logger.log(
            `Account ${account.id} (${accountPublicIdentifier}) does not match linkedin_url: ${linkedinUrl}`,
          );
        }

        return matches;
      });

      if (
        linkedinUnipileAccountId &&
        !accounts.some((a) => a.id === linkedinUnipileAccountId)
      ) {
        const single = await this.fetchAccountByIdIfExists(
          linkedinUnipileAccountId,
        );
        if (single) {
          const mapped = this.mapLinkedinApiItemToAccountRow(single);
          accounts.push(mapped);
          this.logger.log(
            `Included workspace linked account ${linkedinUnipileAccountId} from single-account fetch`,
          );
        }
      }

      this.logger.log(
        `Filtered ${accounts.length} LinkedIn accounts from ${allAccounts.length} total accounts`,
      );

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      this.logger.error('Failed to get LinkedIn accounts:', error);
      throw error;
    }
  }

  async disconnectAccountBestEffort(
    accountId: string,
    context: string,
  ): Promise<void> {
    const trimmed = accountId.trim();
    if (!trimmed) {
      return;
    }
    this.logger.log(
      `Deleting LinkedIn Unipile account accountId=${trimmed} context=${context}`,
    );
    const url = `${this.unipileApiUrl}/api/v1/accounts/${trimmed}`;
    const headers = {
      Accept: 'application/json',
      'X-API-KEY': this.unipileAccessToken || '',
    };
    try {
      const response = await fetch(url, { method: 'DELETE', headers });
      if (response.ok || response.status === 404) {
        invalidateUnipileAccountsListCache();
        this.logger.log(
          `Deleted LinkedIn Unipile account accountId=${trimmed} context=${context} httpStatus=${response.status}`,
        );
        return;
      }
      const data = await response.json().catch(() => ({}));
      this.logger.warn(
        `Best-effort LinkedIn Unipile disconnect failed (${context}): ${response.status}`,
        data,
      );
    } catch (err) {
      this.logger.warn(
        `Best-effort LinkedIn Unipile disconnect error (${context}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
