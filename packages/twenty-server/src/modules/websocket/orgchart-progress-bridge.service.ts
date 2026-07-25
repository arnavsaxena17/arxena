import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ORGCHART_PROGRESS_CHANNEL_PREFIX } from 'src/engine/core-modules/candidate-sourcing/services/orgchart-progress-redis.service';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { WebSocketService } from './websocket.service';

/**
 * Subscribes to Redis orgchart_progress:* on the HTTP server only and forwards
 * messages to Socket.IO so queue workers can push progress without a WS server.
 */
@Injectable()
export class OrgChartProgressBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrgChartProgressBridgeService.name);
  private subscriberClient: Redis | null = null;

  constructor(
    private readonly redisClientService: RedisClientService,
    private readonly webSocketService: WebSocketService,
  ) {}

  private isQueueWorkerProcess(): boolean {
    return (
      process.argv[1]?.includes('queue-worker') === true ||
      process.argv[1]?.includes('queue-worker.js') === true
    );
  }

  onModuleInit(): void {
    if (this.isQueueWorkerProcess()) {
      this.logger.log(
        'Skipping orgchart progress Redis bridge (queue worker process)',
      );
      return;
    }

    const host = this.redisClientService.getClient().options.host;
    const port = this.redisClientService.getClient().options.port;
    const password = this.redisClientService.getClient().options.password;

    this.subscriberClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
    });

    this.subscriberClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
      try {
        if (!channel.startsWith(ORGCHART_PROGRESS_CHANNEL_PREFIX)) {
          return;
        }
        const workspaceMemberId = channel.slice(
          ORGCHART_PROGRESS_CHANNEL_PREFIX.length,
        );
        const payload = JSON.parse(message) as Record<string, unknown>;
        this.webSocketService.sendToUser(
          workspaceMemberId,
          'orgchart-search-progress',
          payload,
        );
      } catch (error) {
        this.logger.error(
          'Failed to forward orgchart progress from Redis to WebSocket',
          error,
        );
      }
    });

    this.subscriberClient.on('error', (err: Error) => {
      this.logger.error('Orgchart progress Redis subscriber error', err);
    });

    void this.subscriberClient
      .psubscribe(`${ORGCHART_PROGRESS_CHANNEL_PREFIX}*`)
      .then(() => {
        this.logger.log(
          `Orgchart progress Redis bridge subscribed (${ORGCHART_PROGRESS_CHANNEL_PREFIX}*)`,
        );
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to psubscribe orgchart progress channels', error);
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriberClient) {
      try {
        await this.subscriberClient.punsubscribe();
        await this.subscriberClient.quit();
      } catch {
        // ignore
      }
      this.subscriberClient = null;
    }
  }
}
