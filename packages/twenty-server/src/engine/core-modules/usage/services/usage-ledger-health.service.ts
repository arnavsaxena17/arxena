/* @license Enterprise */

import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

// Credit balances are computed from ClickHouse usage events, so billing with
// no event sink silently grants unlimited usage. Make that misconfiguration
// impossible to miss in the logs.
@Injectable()
export class UsageLedgerHealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsageLedgerHealthService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly eventLogEmitterService: EventLogEmitterService,
  ) {}

  onApplicationBootstrap(): void {
    this.getConfigurationProblems().forEach((problem) =>
      this.logger.error(problem),
    );
  }

  getConfigurationProblems(): string[] {
    if (!this.twentyConfigService.get('IS_BILLING_ENABLED')) {
      return [];
    }

    const problems: string[] = [];

    if (!this.eventLogEmitterService.isEnabled()) {
      problems.push(
        'IS_BILLING_ENABLED is true but no usage event sink is active (set CLICKHOUSE_URL and include clickhouse in EVENT_SINKS). Usage will not be recorded and credits will never be consumed.',
      );
    }

    if (!this.twentyConfigService.get('BILLING_USAGE_CAP_CLICKHOUSE_ENABLED')) {
      problems.push(
        'BILLING_USAGE_CAP_CLICKHOUSE_ENABLED is false: cap enforcement relies on Stripe billing alerts, which Razorpay workspaces do not have.',
      );
    }

    return problems;
  }
}
