import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';

import { WHATSAPP_OUTBOUND_WINDOW_MS } from './whatsapp-outbound-rate-limit.util';
import { registerWhatsappOutboundRateLimiter } from './whatsapp-outbound-rate-limiter.registry';

const KEY_PREFIX = 'whatsapp-outbound:';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WhatsappOutboundRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappOutboundRateLimiterService.name);

  constructor(private readonly redisService: RedisService) {}

  onModuleInit(): void {
    registerWhatsappOutboundRateLimiter(this);
    this.logger.log('WhatsApp outbound rate limiter registered');
  }

  async waitForOutboundSlot(
    accountId: string,
    messagesPerMinute: number,
  ): Promise<void> {
    const limit = Math.max(1, Math.floor(messagesPerMinute));
    const key = `${KEY_PREFIX}${accountId}`;

    while (true) {
      const now = Date.now();
      const member = `${now}:${Math.random().toString(36).slice(2)}`;
      const { acquired, waitMs } =
        await this.redisService.tryAcquireSlidingWindowSlot(
          key,
          WHATSAPP_OUTBOUND_WINDOW_MS,
          limit,
          member,
          now,
        );

      if (acquired) {
        return;
      }

      const boundedWaitMs = Math.min(
        Math.max(100, Math.ceil(waitMs)),
        WHATSAPP_OUTBOUND_WINDOW_MS,
      );
      this.logger.log(
        `Rate limit reached for account ${accountId}, waiting ${boundedWaitMs}ms (limit: ${limit}/min)`,
      );
      await sleep(boundedWaitMs);
    }
  }
}
