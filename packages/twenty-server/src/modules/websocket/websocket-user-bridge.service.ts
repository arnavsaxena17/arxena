import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import {
    WEBSOCKET_USER_CHANNEL_PREFIX,
    WebSocketUserRedisPayload,
} from './websocket-user-redis.constants';
import { WebSocketService } from './websocket.service';

/**
 * Subscribes to Redis websocket_user:* on the HTTP server only and forwards
 * messages to Socket.IO so queue workers can push user events without a WS server.
 */
@Injectable()
export class WebSocketUserBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketUserBridgeService.name);
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
        'Skipping websocket user Redis bridge (queue worker process)',
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
        if (!channel.startsWith(WEBSOCKET_USER_CHANNEL_PREFIX)) {
          return;
        }
        const workspaceMemberId = channel.slice(
          WEBSOCKET_USER_CHANNEL_PREFIX.length,
        );
        const payload = JSON.parse(message) as WebSocketUserRedisPayload;
        this.webSocketService.sendToUser(
          workspaceMemberId,
          payload.event,
          payload.data,
        );
      } catch (error) {
        this.logger.error(
          'Failed to forward websocket user event from Redis to WebSocket',
          error,
        );
      }
    });

    this.subscriberClient.on('error', (err: Error) => {
      this.logger.error('WebSocket user Redis subscriber error', err);
    });

    void this.subscriberClient
      .psubscribe(`${WEBSOCKET_USER_CHANNEL_PREFIX}*`)
      .then(() => {
        this.logger.log(
          `WebSocket user Redis bridge subscribed (${WEBSOCKET_USER_CHANNEL_PREFIX}*)`,
        );
      })
      .catch((error: unknown) => {
        this.logger.error('Failed to psubscribe websocket user channels', error);
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
