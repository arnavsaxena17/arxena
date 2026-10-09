/* @license Enterprise */

import { Module } from '@nestjs/common';

import { BillingModule } from 'src/engine/core-modules/billing/billing.module';
import { MeteredLlmService } from 'src/engine/core-modules/metered-llm/metered-llm.service';

// AiModelsModule is global, so the model registry is available without importing it
@Module({
  imports: [BillingModule],
  providers: [MeteredLlmService],
  exports: [MeteredLlmService],
})
export class MeteredLlmModule {}
