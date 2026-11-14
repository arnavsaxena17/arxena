import { Injectable, Logger } from '@nestjs/common';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';

const ORGCHART_CANCEL_KEY_PREFIX = 'orgchart_cancel:';
const ORGCHART_CANCEL_TTL_SECONDS = 86_400;

export type OrgchartCancelStatus =
  | 'active'
  | 'cancelled'
  | 'completed'
  | 'failed';

export type OrgchartCancelState = {
  status: OrgchartCancelStatus;
  message?: string;
  mode?: string;
  searchType?: string;
  companyName?: string;
};

export type OrgchartCancelRegisterMetadata = Pick<
  OrgchartCancelState,
  'mode' | 'searchType' | 'companyName'
>;

/**
 * Redis-backed registry of orgchart search request IDs and their terminal states.
 * Shared across the HTTP server and queue worker so cancel/stop is visible everywhere.
 */
@Injectable()
export class OrgchartCancelRegistryService {
  private readonly logger = new Logger(OrgchartCancelRegistryService.name);

  constructor(private readonly redisClientService: RedisClientService) {}

  private key(requestId: string): string {
    return `${ORGCHART_CANCEL_KEY_PREFIX}${requestId}`;
  }

  private async writeState(
    requestId: string,
    state: OrgchartCancelState,
  ): Promise<void> {
    try {
      await this.redisClientService
        .getClient()
        .set(
          this.key(requestId),
          JSON.stringify(state),
          'EX',
          ORGCHART_CANCEL_TTL_SECONDS,
        );
    } catch (error) {
      this.logger.error(
        `Failed to write orgchart cancel state for requestId=${requestId}`,
        error,
      );
    }
  }

  async register(
    requestId: string,
    metadata?: OrgchartCancelRegisterMetadata,
  ): Promise<void> {
    const existing = await this.getState(requestId);

    if (
      existing?.status === 'cancelled' ||
      existing?.status === 'completed' ||
      existing?.status === 'failed'
    ) {
      return;
    }

    await this.writeState(requestId, {
      status: 'active',
      ...metadata,
    });
  }

  async setCancelled(requestId: string): Promise<void> {
    const existing = await this.getState(requestId);

    await this.writeState(requestId, {
      status: 'cancelled',
      mode: existing?.mode,
      searchType: existing?.searchType,
      companyName: existing?.companyName,
    });
  }

  async setCompleted(requestId: string): Promise<void> {
    const existing = await this.getState(requestId);

    await this.writeState(requestId, {
      status: 'completed',
      mode: existing?.mode,
      searchType: existing?.searchType,
      companyName: existing?.companyName,
    });
  }

  async setFailed(requestId: string, message?: string): Promise<void> {
    const existing = await this.getState(requestId);

    await this.writeState(requestId, {
      status: 'failed',
      message,
      mode: existing?.mode,
      searchType: existing?.searchType,
      companyName: existing?.companyName,
    });
  }

  async isCancelled(requestId: string | undefined): Promise<boolean> {
    const state = await this.getState(requestId);

    return state?.status === 'cancelled';
  }

  async getState(
    requestId: string | undefined,
  ): Promise<OrgchartCancelState | undefined> {
    if (!requestId) {
      return undefined;
    }

    try {
      const raw = await this.redisClientService
        .getClient()
        .get(this.key(requestId));

      if (!raw) {
        return undefined;
      }

      return JSON.parse(raw) as OrgchartCancelState;
    } catch (error) {
      this.logger.error(
        `Failed to read orgchart cancel state for requestId=${requestId}`,
        error,
      );

      return undefined;
    }
  }

  async isTerminal(requestId: string | undefined): Promise<boolean> {
    const state = await this.getState(requestId);

    return (
      state?.status === 'cancelled' ||
      state?.status === 'completed' ||
      state?.status === 'failed'
    );
  }

  async clear(requestId: string): Promise<void> {
    try {
      await this.redisClientService.getClient().del(this.key(requestId));
    } catch (error) {
      this.logger.error(
        `Failed to clear orgchart cancel state for requestId=${requestId}`,
        error,
      );
    }
  }
}
