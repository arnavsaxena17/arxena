/* @license Enterprise */

import { Command } from 'nest-commander';

import {
  type MigrationCommandOptions,
  MigrationCommandRunner,
} from 'src/database/commands/command-runners/migration.command-runner';
import { BillingSyncPlansDataCommand } from 'src/engine/core-modules/billing/commands/billing-sync-plans-data.command';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

// Runs after migrate:prod so Razorpay installs get live plans + correct product
// metadata without a separate manual billing:sync-plans-data step.
@Command({
  name: 'billing:ensure-razorpay-catalog',
  description:
    'When BILLING_PROVIDER=razorpay, sync Razorpay plans into billingProduct/billingPrice',
})
export class BillingEnsureRazorpayCatalogCommand extends MigrationCommandRunner {
  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly billingSyncPlansDataCommand: BillingSyncPlansDataCommand,
  ) {
    super();
  }

  override async runMigrationCommand(
    _passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void> {
    const provider = this.environmentService.get('BILLING_PROVIDER');

    if (provider !== 'razorpay') {
      this.logger.log(
        `Skipping Razorpay catalog ensure (BILLING_PROVIDER=${provider ?? 'unset'})`,
      );

      return;
    }

    this.logger.log('Ensuring Razorpay billing catalog via plan sync...');
    await this.billingSyncPlansDataCommand.run([], options);
  }
}
