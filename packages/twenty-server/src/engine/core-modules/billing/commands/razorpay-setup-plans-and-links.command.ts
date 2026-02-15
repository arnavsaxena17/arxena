/* @license Enterprise */

import { Command } from 'nest-commander';

import {
    BaseCommandOptions,
    BaseCommandRunner,
} from 'src/database/commands/base.command';
import { RazorpayPaymentLinkService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-payment-link.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';

@Command({
  name: 'razorpay:setup-plans-and-links',
  description:
    'Creates Razorpay engagement plans (quarterly, 6-month, annual) and one-time credit pack payment links via API',
})
export class RazorpaySetupPlansAndLinksCommand extends BaseCommandRunner {
  constructor(
    private readonly razorpayPlanService: RazorpayPlanService,
    private readonly razorpayPaymentLinkService: RazorpayPaymentLinkService,
  ) {
    super();
  }

  protected override async executeBaseCommand(
    _passedParams: string[],
    options: BaseCommandOptions,
  ): Promise<void> {
    if (options.dryRun) {
      this.logger.log('Dry run: would create Razorpay plans and credit pack payment links');
      return;
    }

    this.logger.log('Creating Razorpay engagement plans (quarterly, 6-month, annual)...');
    const plans = await this.razorpayPlanService.createEngagementPlans();
    this.logger.log(`Created ${plans.length} plans. Add these to .env:`);
    // Order: quarterly (interval 3), 6month (interval 6), annual (interval 1)
    const [quarterly, sixMonth, annual] = plans;
    if (quarterly) this.logger.log(`  BILLING_RAZORPAY_PLAN_QUARTERLY_ID=${quarterly.id}`);
    if (sixMonth) this.logger.log(`  BILLING_RAZORPAY_PLAN_6MONTH_ID=${sixMonth.id}`);
    if (annual) this.logger.log(`  BILLING_RAZORPAY_BASE_PLAN_ID=${annual.id}`);

    this.logger.log('Creating Razorpay payment links for credit packs...');
    const links = await this.razorpayPaymentLinkService.createCreditPackPaymentLinks();
    this.logger.log(`Created ${links.length} payment links:`);
    for (const l of links) {
      this.logger.log(`  ${l.key}: ${l.shortUrl} (id: ${l.id})`);
    }
  }
}
