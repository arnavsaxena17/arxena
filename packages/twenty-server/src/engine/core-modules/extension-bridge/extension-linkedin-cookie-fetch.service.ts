import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { ExtensionSocketGateway } from 'src/engine/core-modules/extension-bridge/extension-socket.gateway';

const PENDING_SET_KEY = 'extension:linkedin-cookie-fetch:pending';
const PENDING_TTL_SECONDS = 12 * 60 * 60;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

type PendingLinkedinCookieFetch = {
  workspaceId: string;
  requestedAt: string;
  deadlineAt: string;
};

export type RequestLinkedinCookieFetchResult = {
  status: 'dispatched' | 'waiting';
  deadlineAt: string;
};

const pendingKey = (workspaceMemberId: string): string =>
  `extension:linkedin-cookie-fetch:${workspaceMemberId}`;

const parsePending = (
  raw: string | null,
): PendingLinkedinCookieFetch | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingLinkedinCookieFetch>;

    if (
      typeof parsed.workspaceId !== 'string' ||
      typeof parsed.requestedAt !== 'string' ||
      typeof parsed.deadlineAt !== 'string'
    ) {
      return null;
    }

    return {
      workspaceId: parsed.workspaceId,
      requestedAt: parsed.requestedAt,
      deadlineAt: parsed.deadlineAt,
    };
  } catch {
    return null;
  }
};

@Injectable()
export class ExtensionLinkedinCookieFetchService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    ExtensionLinkedinCookieFetchService.name,
  );
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly redisClientService: RedisClientService,
    private readonly extensionSocketGateway: ExtensionSocketGateway,
  ) {}

  onModuleInit(): void {
    this.extensionSocketGateway.registerLinkedinCookieFetchHooks({
      onConnected: (workspaceMemberId) => {
        void this.flushPendingForMember(workspaceMemberId);
      },
      onCookiesFetched: (workspaceMemberId) => {
        void this.clearPending(workspaceMemberId);
      },
    });
    this.sweepTimer = setInterval(() => {
      void this.sweepPendingFetches();
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  async requestFetch(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<RequestLinkedinCookieFetchResult> {
    const requestedAt = new Date().toISOString();
    const deadlineAt = new Date(
      Date.now() + PENDING_TTL_SECONDS * 1000,
    ).toISOString();
    const pending: PendingLinkedinCookieFetch = {
      workspaceId,
      requestedAt,
      deadlineAt,
    };
    const redis = this.redisClientService.getClient();

    await redis.set(
      pendingKey(workspaceMemberId),
      JSON.stringify(pending),
      'EX',
      PENDING_TTL_SECONDS,
    );
    await redis.sadd(PENDING_SET_KEY, workspaceMemberId);

    const dispatched = await this.flushPendingForMember(workspaceMemberId);

    return {
      status: dispatched ? 'dispatched' : 'waiting',
      deadlineAt,
    };
  }

  async getPendingDeadlines(
    workspaceMemberIds: string[],
  ): Promise<Map<string, string>> {
    const deadlines = new Map<string, string>();

    if (workspaceMemberIds.length === 0) {
      return deadlines;
    }

    const redis = this.redisClientService.getClient();
    const rawValues = await redis.mget(
      ...workspaceMemberIds.map((workspaceMemberId) =>
        pendingKey(workspaceMemberId),
      ),
    );

    workspaceMemberIds.forEach((workspaceMemberId, index) => {
      const pending = parsePending(rawValues[index] ?? null);

      if (!pending) {
        return;
      }

      if (Date.parse(pending.deadlineAt) <= Date.now()) {
        return;
      }

      deadlines.set(workspaceMemberId, pending.deadlineAt);
    });

    return deadlines;
  }

  async clearPending(workspaceMemberId: string): Promise<void> {
    const redis = this.redisClientService.getClient();

    await redis.del(pendingKey(workspaceMemberId));
    await redis.srem(PENDING_SET_KEY, workspaceMemberId);
  }

  async flushPendingForMember(workspaceMemberId: string): Promise<boolean> {
    const redis = this.redisClientService.getClient();
    const pending = parsePending(
      await redis.get(pendingKey(workspaceMemberId)),
    );

    if (!pending || Date.parse(pending.deadlineAt) <= Date.now()) {
      if (pending) {
        await this.clearPending(workspaceMemberId);
      }

      return false;
    }

    const emitted = await this.extensionSocketGateway.emitToWorkspaceMember(
      workspaceMemberId,
      'fetch_linkedin_cookies',
      {
        source: 'admin',
        workspaceId: pending.workspaceId,
        requestedAt: pending.requestedAt,
      },
    );

    if (!emitted) {
      return false;
    }

    await this.clearPending(workspaceMemberId);

    return true;
  }

  async sweepPendingFetches(): Promise<void> {
    const redis = this.redisClientService.getClient();
    const workspaceMemberIds = await redis.smembers(PENDING_SET_KEY);

    for (const workspaceMemberId of workspaceMemberIds) {
      try {
        const pending = parsePending(
          await redis.get(pendingKey(workspaceMemberId)),
        );

        if (!pending) {
          await redis.srem(PENDING_SET_KEY, workspaceMemberId);
          continue;
        }

        await this.flushPendingForMember(workspaceMemberId);
      } catch (error) {
        this.logger.error(
          `LinkedIn cookie fetch sweep failed for ${workspaceMemberId}`,
          error,
        );
      }
    }
  }
}
