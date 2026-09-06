import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
  DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
  LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS,
  MS_PER_DAY,
  MS_PER_FIVE_MINUTES,
  MS_PER_MINUTE,
  MS_PER_TEN_SECONDS,
  MS_PER_THIRTY_SECONDS,
  WHATSAPP_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS,
  getAccountRateLimitWindowMs,
  sanitizeLinkedinAccountRateLimits,
  sanitizeWhatsappAccountRateLimits,
  type LinkedinAccountRateLimits,
  type WhatsappAccountRateLimits,
} from 'twenty-shared/arx';

import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { AccountRateLimitConfigService } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-config.service';
import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  hasAccountRateLimitAcquireScope,
  peekAccountRateLimitReservationBase,
  popAccountRateLimitAcquireRecord,
  pushAccountRateLimitAcquireRecord,
  takeAccountRateLimitReservationMember,
  workflowRunIdFromReservationBase,
  type AccountRateLimitAcquireRecord,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-reservation.context';
import { shouldPaceAccountRateLimitWindow } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-slot.util';
import { registerAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';

export type AccountRateLimitProvider = 'linkedin' | 'whatsapp';

export type LinkedinRateLimitMethod =
  | 'endpoint'
  | 'company_profile'
  | 'profile'
  | 'connection_request'
  | 'comment'
  | 'message'
  | 'inmail'
  | 'search';

export type WhatsappRateLimitMethod = 'endpoint' | 'start_chat';

export type AccountRateLimitMethod =
  | LinkedinRateLimitMethod
  | WhatsappRateLimitMethod;

export const MAX_IN_PROCESS_WAIT_MS = 120_000;
const GHOST_SET_TTL_SECONDS = 2 * 24 * 60 * 60;
const GHOST_SET_PREFIX = 'account-rate-limit-ghost:';

const escapeRedisGlob = (value: string): string =>
  value.replace(/[\\*?[\]]/g, '\\$&');

export const buildAccountRateLimitUsageKey = (
  provider: AccountRateLimitProvider,
  accountId: string,
  method: string,
  windowName: string,
): string => `${provider}:${accountId}:${method}:${windowName}`;

export const buildAccountRateLimitUsageScanPattern = (
  provider: AccountRateLimitProvider,
  accountId: string,
  method?: string,
): string => {
  const escapedAccountId = escapeRedisGlob(accountId);

  if (method) {
    return `${provider}:${escapedAccountId}:${escapeRedisGlob(method)}:*`;
  }

  return `${provider}:${escapedAccountId}:*`;
};

type RateLimitWindow = {
  key: string;
  windowMs: number;
  limit: number;
  pace: boolean;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const serializeGhostRecord = (record: AccountRateLimitAcquireRecord): string =>
  JSON.stringify({
    provider: record.provider,
    accountId: record.accountId,
    method: record.method,
    member: record.member,
    keys: record.keys,
  });

const parseGhostRecord = (
  raw: string,
): AccountRateLimitAcquireRecord | undefined => {
  try {
    const parsed = JSON.parse(raw) as Partial<AccountRateLimitAcquireRecord>;
    if (
      typeof parsed.provider !== 'string' ||
      typeof parsed.accountId !== 'string' ||
      typeof parsed.method !== 'string' ||
      typeof parsed.member !== 'string' ||
      !Array.isArray(parsed.keys) ||
      parsed.keys.some((key) => typeof key !== 'string')
    ) {
      return undefined;
    }

    return {
      provider: parsed.provider,
      accountId: parsed.accountId,
      method: parsed.method,
      member: parsed.member,
      keys: parsed.keys,
    };
  } catch {
    return undefined;
  }
};

@Injectable()
export class AccountRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(AccountRateLimiterService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: AccountRateLimitConfigService,
  ) {}

  onModuleInit(): void {
    registerAccountRateLimiter(this);
  }

  async tryAcquire(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
    method: AccountRateLimitMethod;
    startChatPerMinuteOverride?: number;
    member?: string;
    // Reserve as if "now" were this instant (e.g. next send-window open)
    asOfMs?: number;
  }): Promise<{ acquired: boolean; waitMs: number }> {
    const accountId = params.accountId.trim();
    if (!accountId) {
      return { acquired: true, waitMs: 0 };
    }

    const windows = await this.buildWindows({
      ...params,
      accountId,
    });

    if (windows.length === 0) {
      return { acquired: true, waitMs: 0 };
    }

    const now =
      typeof params.asOfMs === 'number' && Number.isFinite(params.asOfMs)
        ? params.asOfMs
        : Date.now();
    const member =
      params.member ??
      takeAccountRateLimitReservationMember() ??
      `${now}:${Math.random().toString(36).slice(2)}`;
    const result = await this.redisService.tryAcquireMultiWindowSlots(
      windows,
      member,
      now,
    );
    const record: AccountRateLimitAcquireRecord = {
      provider: params.provider,
      accountId,
      method: params.method,
      member,
      keys: windows.map((window) => window.key),
    };
    await this.rememberAcquisition(record);

    return result;
  }

  async commitLastAcquisition(): Promise<void> {
    const record = popAccountRateLimitAcquireRecord();
    if (!record) {
      return;
    }

    await this.untrackGhost(record);
  }

  async releaseLastAcquisition(): Promise<void> {
    const record = popAccountRateLimitAcquireRecord();
    if (!record) {
      return;
    }

    await this.redisService.removeMemberFromWindows(record.keys, record.member);
    await this.untrackGhost(record);
    this.logger.log(
      `Released unused ${record.provider} ${record.method} slot for account ${record.accountId}`,
    );
  }

  async releaseGhostReservationsForWorkflowRun(
    workflowRunId: string,
  ): Promise<{ released: number }> {
    const trimmed = workflowRunId.trim();
    if (!trimmed) {
      return { released: 0 };
    }

    const ghostKey = `${GHOST_SET_PREFIX}${trimmed}`;
    const records = await this.redisService.getSetMembers(ghostKey);
    let released = 0;

    for (const raw of records) {
      const parsed = parseGhostRecord(raw);
      if (!parsed) {
        continue;
      }

      released += await this.redisService.removeMemberFromWindows(
        parsed.keys,
        parsed.member,
      );
    }

    if (records.length > 0) {
      await this.redisService.deleteKeys(ghostKey);
    }

    if (released > 0) {
      this.logger.log(
        `Released ${released} unused rate-limit members for stopped workflow ${trimmed}`,
      );
    }

    return { released };
  }

  private async rememberAcquisition(
    record: AccountRateLimitAcquireRecord,
  ): Promise<void> {
    if (!hasAccountRateLimitAcquireScope()) {
      return;
    }

    pushAccountRateLimitAcquireRecord(record);
    await this.trackGhost(record);
  }

  private async trackGhost(
    record: AccountRateLimitAcquireRecord,
  ): Promise<void> {
    const workflowRunId = workflowRunIdFromReservationBase(
      peekAccountRateLimitReservationBase(),
    );
    if (!workflowRunId) {
      return;
    }

    await this.redisService.addSetMembers(
      `${GHOST_SET_PREFIX}${workflowRunId}`,
      [serializeGhostRecord(record)],
      GHOST_SET_TTL_SECONDS,
    );
  }

  private async untrackGhost(
    record: AccountRateLimitAcquireRecord,
  ): Promise<void> {
    const workflowRunId = workflowRunIdFromReservationBase(
      peekAccountRateLimitReservationBase(),
    );
    if (!workflowRunId) {
      return;
    }

    await this.redisService.removeSetMembers(
      `${GHOST_SET_PREFIX}${workflowRunId}`,
      [serializeGhostRecord(record)],
    );
  }

  async flushUsage(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
    method?: string;
    windowName?: string;
  }): Promise<{ deletedKeys: number }> {
    const accountId = params.accountId.trim();
    if (!accountId) {
      return { deletedKeys: 0 };
    }

    const method = params.method?.trim();
    const windowName = params.windowName?.trim();
    const deletedKeys =
      method && windowName
        ? await this.redisService.deleteKeys(
            buildAccountRateLimitUsageKey(
              params.provider,
              accountId,
              method,
              windowName,
            ),
          )
        : await this.redisService.deleteByPattern(
            buildAccountRateLimitUsageScanPattern(
              params.provider,
              accountId,
              method,
            ),
          );

    this.logger.log(
      `Flushed ${deletedKeys} ${params.provider} rate-limit usage keys for account ${accountId}${
        method ? ` ${method}` : ''
      }${windowName ? `:${windowName}` : ''}`,
    );

    return { deletedKeys };
  }

  async getUsageBreakdown(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
  }): Promise<
    Record<
      string,
      { used: number; reserved: number; nextSlotAt: string | null }
    >
  > {
    const accountId = params.accountId.trim();
    if (!accountId) {
      return {};
    }

    const usageWindows =
      params.provider === 'linkedin'
        ? LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS
        : WHATSAPP_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS;

    const fields = (
      Object.entries(usageWindows) as Array<
        [string, { method: string; windowName: string }]
      >
    ).flatMap(([fieldKey, window]) => {
      const windowMs = getAccountRateLimitWindowMs(window.windowName);
      if (windowMs == null) {
        return [];
      }

      return [
        {
          fieldKey,
          key: buildAccountRateLimitUsageKey(
            params.provider,
            accountId,
            window.method,
            window.windowName,
          ),
          windowMs,
        },
      ];
    });

    const now = Date.now();
    const breakdowns = await this.redisService.getSlidingWindowUsageBreakdown(
      fields.map(({ key, windowMs }) => ({ key, windowMs })),
      now,
    );

    return Object.fromEntries(
      fields.map((field, index) => {
        const breakdown = breakdowns[index] ?? {
          used: 0,
          reserved: 0,
          maxScore: null,
        };
        const nextSlotAt =
          breakdown.reserved > 0 &&
          typeof breakdown.maxScore === 'number' &&
          breakdown.maxScore > now
            ? new Date(breakdown.maxScore).toISOString()
            : null;

        return [
          field.fieldKey,
          {
            used: breakdown.used,
            reserved: breakdown.reserved,
            nextSlotAt,
          },
        ];
      }),
    );
  }

  async getUsage(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
  }): Promise<Record<string, number>> {
    const breakdown = await this.getUsageBreakdown(params);

    return Object.fromEntries(
      Object.entries(breakdown).map(([fieldKey, fieldBreakdown]) => [
        fieldKey,
        fieldBreakdown.used,
      ]),
    );
  }

  async acquireOrDefer(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
    method: AccountRateLimitMethod;
    startChatPerMinuteOverride?: number;
    maxInProcessWaitMs?: number;
  }): Promise<void> {
    const maxInProcessWaitMs =
      params.maxInProcessWaitMs ?? MAX_IN_PROCESS_WAIT_MS;
    const member =
      takeAccountRateLimitReservationMember() ??
      `${Date.now()}:${Math.random().toString(36).slice(2)}`;

    while (true) {
      const { acquired, waitMs } = await this.tryAcquire({
        ...params,
        member,
      });
      if (acquired) {
        return;
      }

      if (waitMs > maxInProcessWaitMs) {
        // Keep the reserved future slot so deferred waiters stay spaced
        // instead of all waking at the same instant (thundering herd).
        // Usage / day-cap counts only scores <= now, so future holds do not
        // inflate live quota. Ghost cleanup releases the hold if the run stops.
        throw new AccountRateLimitDeferredError({
          waitMs,
          accountId: params.accountId,
          method: params.method,
        });
      }

      this.logger.log(
        `Waiting ${waitMs}ms for ${params.provider} ${params.method} on account ${params.accountId}`,
      );
      await sleep(waitMs);
    }
  }

  private async buildWindows(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
    method: AccountRateLimitMethod;
    startChatPerMinuteOverride?: number;
  }): Promise<RateLimitWindow[]> {
    if (params.provider === 'linkedin') {
      const limits = await this.resolveLinkedinLimits(params.accountId);
      return this.buildLinkedinWindows(
        params.accountId,
        params.method as LinkedinRateLimitMethod,
        limits,
      );
    }

    const limits = await this.resolveWhatsappLimits(params.accountId);
    if (
      typeof params.startChatPerMinuteOverride === 'number' &&
      params.startChatPerMinuteOverride > 0
    ) {
      limits.startChatPerMinute = Math.min(
        limits.startChatPerMinute,
        Math.floor(params.startChatPerMinuteOverride),
      );
    }

    return this.buildWhatsappWindows(
      params.accountId,
      params.method as WhatsappRateLimitMethod,
      limits,
    );
  }

  private async resolveLinkedinLimits(accountId: string) {
    const cached = await this.configService.readCachedLinkedinLimits(accountId);
    return sanitizeLinkedinAccountRateLimits(
      cached ?? DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
    );
  }

  private async resolveWhatsappLimits(accountId: string) {
    const cached = await this.configService.readCachedWhatsappLimits(accountId);
    return sanitizeWhatsappAccountRateLimits(
      cached ?? DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
    );
  }

  private buildLinkedinWindows(
    accountId: string,
    method: LinkedinRateLimitMethod,
    limits: LinkedinAccountRateLimits,
  ): RateLimitWindow[] {
    switch (method) {
      case 'endpoint':
        return [];
      case 'company_profile':
        return [
          this.window(
            accountId,
            'linkedin',
            'company_profile',
            '10s',
            limits.companyProfilePer10Seconds,
            MS_PER_TEN_SECONDS,
          ),
          this.window(
            accountId,
            'linkedin',
            'company_profile',
            'day',
            limits.companyProfilePerDay,
            MS_PER_DAY,
          ),
        ];
      case 'profile':
        return [
          this.window(
            accountId,
            'linkedin',
            'profile',
            '10s',
            limits.profilePer10Seconds,
            MS_PER_TEN_SECONDS,
          ),
          this.window(
            accountId,
            'linkedin',
            'profile',
            'day',
            limits.profilePerDay,
            MS_PER_DAY,
          ),
        ];
      case 'connection_request':
        return [
          this.window(
            accountId,
            'linkedin',
            'connection_request',
            '5m',
            limits.connectionRequestPer5Minutes,
            MS_PER_FIVE_MINUTES,
          ),
          this.window(
            accountId,
            'linkedin',
            'connection_request',
            'day',
            limits.connectionRequestPerDay,
            MS_PER_DAY,
          ),
        ];
      case 'comment':
        return [
          this.window(
            accountId,
            'linkedin',
            'comment',
            '30s',
            limits.commentPer30Seconds,
            MS_PER_THIRTY_SECONDS,
          ),
          this.window(
            accountId,
            'linkedin',
            'comment',
            'day',
            limits.commentPerDay,
            MS_PER_DAY,
          ),
        ];
      case 'message':
        return [
          this.window(
            accountId,
            'linkedin',
            'message',
            '30s',
            limits.messagePer30Seconds,
            MS_PER_THIRTY_SECONDS,
          ),
          this.window(
            accountId,
            'linkedin',
            'message',
            'day',
            limits.messagePerDay,
            MS_PER_DAY,
          ),
        ];
      case 'inmail':
        return [
          this.window(
            accountId,
            'linkedin',
            'inmail',
            '30s',
            limits.inmailPer30Seconds,
            MS_PER_THIRTY_SECONDS,
          ),
          this.window(
            accountId,
            'linkedin',
            'inmail',
            'day',
            limits.inmailPerDay,
            MS_PER_DAY,
          ),
        ];
      case 'search':
        return [
          this.window(
            accountId,
            'linkedin',
            'search',
            'minute',
            limits.searchPerMinute,
            MS_PER_MINUTE,
          ),
          this.window(
            accountId,
            'linkedin',
            'search',
            'day',
            limits.searchPerDay,
            MS_PER_DAY,
          ),
        ];
      default:
        return [];
    }
  }

  private buildWhatsappWindows(
    accountId: string,
    method: WhatsappRateLimitMethod,
    limits: WhatsappAccountRateLimits,
  ): RateLimitWindow[] {
    if (method === 'start_chat') {
      return [
        this.window(
          accountId,
          'whatsapp',
          'start_chat',
          'minute',
          limits.startChatPerMinute,
          MS_PER_MINUTE,
        ),
        this.window(
          accountId,
          'whatsapp',
          'start_chat',
          'day',
          limits.startChatPerDay,
          MS_PER_DAY,
        ),
      ];
    }

    return [
      this.window(
        accountId,
        'whatsapp',
        'endpoint',
        'minute',
        limits.endpointPerMinute,
        MS_PER_MINUTE,
      ),
      this.window(
        accountId,
        'whatsapp',
        'endpoint',
        'day',
        limits.endpointPerDay,
        MS_PER_DAY,
      ),
    ];
  }

  private window(
    accountId: string,
    provider: AccountRateLimitProvider,
    method: string,
    windowName: string,
    limit: number,
    windowMs: number,
  ): RateLimitWindow {
    return {
      key: buildAccountRateLimitUsageKey(
        provider,
        accountId,
        method,
        windowName,
      ),
      limit: Math.max(1, limit),
      windowMs,
      pace: shouldPaceAccountRateLimitWindow(windowMs),
    };
  }
}
