import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS,
  DEFAULT_WHATSAPP_ACCOUNT_RATE_LIMITS,
  LINKEDIN_ACCOUNT_RATE_LIMIT_USAGE_WINDOWS,
  MS_PER_DAY,
  MS_PER_FIVE_MINUTES,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_THIRTY_SECONDS,
  MS_PER_TWO_SECONDS,
  MS_PER_WEEK,
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
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

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

    const now = Date.now();
    const member = `${now}:${Math.random().toString(36).slice(2)}`;
    return this.redisService.tryAcquireMultiWindowSlots(windows, member, now);
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

  async getUsage(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
  }): Promise<Record<string, number>> {
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

    const counts = await this.redisService.countSlidingWindowMembers(
      fields.map(({ key, windowMs }) => ({ key, windowMs })),
      Date.now(),
    );

    return Object.fromEntries(
      fields.map((field, index) => [field.fieldKey, counts[index] ?? 0]),
    );
  }

  async acquireOrDefer(params: {
    provider: AccountRateLimitProvider;
    accountId: string;
    method: AccountRateLimitMethod;
    startChatPerMinuteOverride?: number;
    maxInProcessWaitMs?: number;
  }): Promise<void> {
    const maxInProcessWaitMs = params.maxInProcessWaitMs ?? MAX_IN_PROCESS_WAIT_MS;

    while (true) {
      const { acquired, waitMs } = await this.tryAcquire(params);
      if (acquired) {
        return;
      }

      if (waitMs > maxInProcessWaitMs) {
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
    // Method-specific actions use only their own windows so a full
    // endpoint:day counter (shared by profile lookups, facet searches, etc.)
    // cannot defer a connection request until tomorrow. Retry wait is then
    // the next free slot in this method's windows (e.g. 5 min / hour / day
    // / week for connection requests).
    const usesSharedEndpointWindows =
      method === 'endpoint' ||
      method === 'company_profile' ||
      method === 'profile';

    const windows: RateLimitWindow[] = usesSharedEndpointWindows
      ? [
          this.window(
            accountId,
            'linkedin',
            'endpoint',
            'minute',
            limits.endpointPerMinute,
            MS_PER_MINUTE,
          ),
          this.window(
            accountId,
            'linkedin',
            'endpoint',
            'day',
            limits.endpointPerDay,
            MS_PER_DAY,
          ),
        ]
      : [];

    if (method === 'company_profile') {
      windows.push(
        this.window(
          accountId,
          'linkedin',
          'company_profile',
          '2s',
          limits.companyProfilePer2Seconds,
          MS_PER_TWO_SECONDS,
        ),
      );
    }

    if (method === 'profile') {
      windows.push(
        this.window(
          accountId,
          'linkedin',
          'profile',
          '2s',
          limits.profilePer2Seconds,
          MS_PER_TWO_SECONDS,
        ),
      );
    }

    if (method === 'connection_request') {
      windows.push(
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
          'hour',
          limits.connectionRequestPerHour,
          MS_PER_HOUR,
        ),
        this.window(
          accountId,
          'linkedin',
          'connection_request',
          'day',
          limits.connectionRequestPerDay,
          MS_PER_DAY,
        ),
        this.window(
          accountId,
          'linkedin',
          'connection_request',
          'week',
          limits.connectionRequestPerWeek,
          MS_PER_WEEK,
        ),
      );
    }

    if (method === 'comment') {
      windows.push(
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
      );
    }

    if (method === 'message') {
      windows.push(
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
      );
    }

    if (method === 'inmail') {
      windows.push(
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
      );
    }

    if (method === 'search') {
      windows.push(
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
      );
    }

    return windows;
  }

  private buildWhatsappWindows(
    accountId: string,
    method: WhatsappRateLimitMethod,
    limits: WhatsappAccountRateLimits,
  ): RateLimitWindow[] {
    const windows: RateLimitWindow[] = [
      this.window(accountId, 'whatsapp', 'endpoint', 'minute', limits.endpointPerMinute, MS_PER_MINUTE),
      this.window(accountId, 'whatsapp', 'endpoint', 'day', limits.endpointPerDay, MS_PER_DAY),
    ];

    if (method === 'start_chat') {
      windows.push(
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
      );
    }

    return windows;
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
    };
  }
}
