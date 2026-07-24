/* @license Enterprise */

import { Command } from 'nest-commander';

import {
  type MigrationCommandOptions,
  MigrationCommandRunner,
} from 'src/database/commands/command-runners/migration.command-runner';
import { BillingStripeCatalogService } from 'src/engine/core-modules/billing/services/billing-stripe-catalog.service';

@Command({
  name: 'billing:ensure-stripe-catalog',
  description:
    'Idempotently ensures required Stripe billing products/prices exist with Twenty metadata',
})
export class BillingEnsureStripeCatalogCommand extends MigrationCommandRunner {
  constructor(
    private readonly billingStripeCatalogService: BillingStripeCatalogService,
  ) {
    super();
  }

  override async runMigrationCommand(
    _passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void> {
    await this.billingStripeCatalogService.ensureRequiredCatalog({
      dryRun: options.dryRun,
    });

    if (options.dryRun !== true) {
      await this.billingStripeCatalogService.assertRequiredCatalogExistsInStripe();
    }
  }
}
