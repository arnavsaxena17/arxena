import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { TypeORMModule } from 'src/database/typeorm/typeorm.module';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { AccountRateLimitConfigService } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-config.service';
import { AccountRateLimiterService } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';
import { KeyValuePairModule } from 'src/engine/core-modules/key-value-pair/key-value-pair.module';

@Module({
  imports: [ConfigModule, TypeORMModule, KeyValuePairModule],
  providers: [
    RedisService,
    AccountRateLimitConfigService,
    AccountRateLimiterService,
  ],
  exports: [AccountRateLimitConfigService, AccountRateLimiterService],
})
export class AccountRateLimitModule {}
