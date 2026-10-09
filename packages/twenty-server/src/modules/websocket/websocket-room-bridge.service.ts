import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Redis } from 'ioredis';

import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import {
  WEBSOCKET_ROOM_CHANNEL_PREFIX,
  type WebSocketRoomRedisPayload,
} from 'src/modules/websocket/websocket-user-redis.constants';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

// Subscribes to Redis websocket_room:* on the HTTP server only and forwards
// room events to Socket.IO, so queue workers can notify rooms (for example the
// outreach project room) without running a socket server.
@Injectable()
export class WebSocketRoomBridgeService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WebSocketRoomBridgeService.name);
  private subscriberClient: Redis | null = null;

  constructor(
    private readonly redisClientService: RedisClientService,
    private readonly webSocketService: WebSocketService,
  ) {}

  private isQueueWorkerProcess(): boolean {
    return process.argv[1]?.includes('queue-worker') === true;
  }

  onModuleInit(): void {
    if (this.isQueueWorkerProcess()) {
      return;
    }

    const { host, port, password } =
      this.redisClientService.getClient().options;

    this.subscriberClient = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
    });

    this.subscriberClient.on(
      'pmessage',
      (_pattern: string, _channel: string, message: string) => {
        try {
          const payload = JSON.parse(message) as WebSocketRoomRedisPayload;

          this.webSocketService.sendToRoom(
            payload.room,
            payload.event,
            payload.data,
          );
        } catch (error) {
          this.logger.error(
            'Failed to forward websocket room event from Redis',
            error,
          );
        }
      },
    );

    this.subscriberClient.on('error', (error: Error) => {
      this.logger.error('WebSocket room Redis subscriber error', error);
    });

    void this.subscriberClient
      .psubscribe(`${WEBSOCKET_ROOM_CHANNEL_PREFIX}*`)
      .catch((error: unknown) => {
        this.logger.error('Failed to psubscribe websocket room channels', error);
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
