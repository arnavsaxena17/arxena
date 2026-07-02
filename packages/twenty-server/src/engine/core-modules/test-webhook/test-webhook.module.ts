import { Module } from '@nestjs/common';

import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';

import { TestWebhookController } from './test-webhook.controller';
import { TestWebhookService } from './test-webhook.service';

@Module({
  imports: [EnvironmentModule],
  controllers: [TestWebhookController],
  providers: [TestWebhookService],
})
export class TestWebhookModule {}
