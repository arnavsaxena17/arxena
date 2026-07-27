/* @license Enterprise */

import { InjectRepository } from '@nestjs/typeorm';

import { Command, Option } from 'nest-commander';
import { Repository } from 'typeorm';

import type Stripe from 'stripe';

import {
  type MigrationCommandOptions,
  MigrationCommandRunner,
} from 'src/database/commands/command-runners/migration.command-runner';
import { BillingMeterEntity } from 'src/engine/core-modules/billing/entities/billing-meter.entity';
import { BillingPriceEntity } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { BillingProductEntity } from 'src/engine/core-modules/billing/entities/billing-product.entity';
import { BillingPriceBillingScheme } from 'src/engine/core-modules/billing/enums/billing-price-billing-scheme.enum';
import { BillingPriceTaxBehavior } from 'src/engine/core-modules/billing/enums/billing-price-tax-behavior.enum';
import { BillingPriceType } from 'src/engine/core-modules/billing/enums/billing-price-type.enum';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { BillingUsageType } from 'src/engine/core-modules/billing/enums/billing-usage-type.enum';
import {
  RAZORPAY_BASE_PRODUCT_ID,
  RAZORPAY_BASE_PRODUCT_METADATA,
} from 'src/engine/core-modules/billing/constants/razorpay-base-product.constant';
import {
  type RazorpayPlan,
  RazorpayPlanService,
} from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { BillingStripeCatalogService } from 'src/engine/core-modules/billing/services/billing-stripe-catalog.service';
import { StripeBillingMeterService } from 'src/engine/core-modules/billing/stripe/services/stripe-billing-meter.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { StripeProductService } from 'src/engine/core-modules/billing/stripe/services/stripe-product.service';
import { isStripeValidProductMetadata } from 'src/engine/core-modules/billing/utils/is-stripe-valid-product-metadata.util';
import { transformStripeMeterToDatabaseMeter } from 'src/engine/core-modules/billing/utils/transform-stripe-meter-to-database-meter.util';
import { transformStripePriceToDatabasePrice } from 'src/engine/core-modules/billing/utils/transform-stripe-price-to-database-price.util';
import { transformStripeProductToDatabaseProduct } from 'src/engine/core-modules/billing/utils/transform-stripe-product-to-database-product.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Command({
  name: 'billing:sync-plans-data',
  description:
    'Fetches from Stripe or Razorpay the plans data and upserts it into the database',
})
export class BillingSyncPlansDataCommand extends MigrationCommandRunner {
  private readonly batchSize = 5;
  private ensureCatalog = false;

  constructor(
    @InjectRepository(BillingPriceEntity)
    private readonly billingPriceRepository: Repository<BillingPriceEntity>,
    @InjectRepository(BillingProductEntity)
    private readonly billingProductRepository: Repository<BillingProductEntity>,
    @InjectRepository(BillingMeterEntity)
    private readonly billingMeterRepository: Repository<BillingMeterEntity>,
    private readonly environmentService: EnvironmentService,
    private readonly stripeBillingMeterService: StripeBillingMeterService,
    private readonly stripeProductService: StripeProductService,
    private readonly stripePriceService: StripePriceService,
    private readonly billingStripeCatalogService: BillingStripeCatalogService,
    private readonly razorpayPlanService: RazorpayPlanService,
  ) {
    super();
  }

  @Option({
    flags: '-e, --ensure-catalog',
    description:
      'Ensure required Stripe catalog products/prices exist before syncing to the database',
    required: false,
  })
  parseEnsureCatalog(): boolean {
    this.ensureCatalog = true;

    return true;
  }

  private async upsertMetersRepositoryData(
    meters: Stripe.Billing.Meter[],
    options: MigrationCommandOptions,
  ) {
    await Promise.all(
      meters.map(async (meter) => {
        try {
          if (!options.dryRun) {
            await this.billingMeterRepository.upsert(
              transformStripeMeterToDatabaseMeter(meter),
              {
                conflictPaths: ['stripeMeterId'],
              },
            );
          }
          this.logger.log(`Upserted meter: ${meter.id}`);
        } catch (error) {
          this.logger.error(`Error upserting meter ${meter.id}: ${error}`);
        }
      }),
    );
  }

  private async upsertProductRepositoryData(
    product: Stripe.Product,
    options: MigrationCommandOptions,
  ) {
    try {
      if (!options.dryRun) {
        await this.billingProductRepository.upsert(
          transformStripeProductToDatabaseProduct(product),
          {
            conflictPaths: ['stripeProductId'],
          },
        );
      }
      this.logger.log(`Upserted product: ${product.id}`);
    } catch (error) {
      this.logger.error(`Error upserting product ${product.id}: ${error}`);
    }
  }

  private async getBillingPrices(
    products: Stripe.Product[],
    options: MigrationCommandOptions,
  ): Promise<Stripe.Price[][]> {
    return await Promise.all(
      products.map(async (product) => {
        if (!isStripeValidProductMetadata(product.metadata)) {
          this.logger.log(
            `Product: ${product.id} purposefully not inserted, invalid metadata format: ${JSON.stringify(
              product.metadata,
            )}`,
          );

          return [];
        }
        await this.upsertProductRepositoryData(product, options);

        const prices = await this.stripePriceService.getPricesByProductId(
          product.id,
        );

        this.logger.log(
          `${prices.length} prices found for product: ${product.id}`,
        );

        return prices;
      }),
    );
  }

  private async processBillingPricesByProductBatches(
    products: Stripe.Product[],
    options: MigrationCommandOptions,
  ) {
    const prices: Stripe.Price[][] = [];

    for (let start = 0; start < products.length; start += this.batchSize) {
      const end =
        start + this.batchSize > products.length
          ? products.length
          : start + this.batchSize;

      const batch = products.slice(start, end);
      const batchPrices = await this.getBillingPrices(batch, options);

      prices.push(...batchPrices);
      this.logger.log(
        `Processed batch ${start / this.batchSize + 1} of products`,
      );
    }

    return prices;
  }

  private resolveRazorpaySubscriptionInterval(
    plan: RazorpayPlan,
  ): SubscriptionInterval {
    if (plan.period === 'yearly') {
      return SubscriptionInterval.Year;
    }

    return SubscriptionInterval.Month;
  }

  private resolveRazorpayRecurring(
    plan: RazorpayPlan,
  ): Stripe.Price.Recurring {
    const interval =
      plan.period === 'yearly'
        ? 'year'
        : plan.period === 'weekly'
          ? 'week'
          : plan.period === 'daily'
            ? 'day'
            : 'month';

    return {
      interval,
      interval_count: plan.interval,
      usage_type: 'licensed',
      meter: null,
      trial_period_days: null,
    };
  }

  private async syncRazorpayPlans(
    options: MigrationCommandOptions,
  ): Promise<void> {
    const plans = await this.razorpayPlanService.getAllPlans();

    this.logger.log(`Fetched ${plans.length} Razorpay plans`);

    const productExists = await this.billingProductRepository.findOne({
      where: { stripeProductId: RAZORPAY_BASE_PRODUCT_ID },
    });

    if (!options.dryRun) {
      if (!productExists) {
        await this.billingProductRepository.insert({
          stripeProductId: RAZORPAY_BASE_PRODUCT_ID,
          name: 'Razorpay Base',
          active: true,
          description: '',
          images: [],
          marketingFeatures: [],
          metadata: RAZORPAY_BASE_PRODUCT_METADATA,
        });
        this.logger.log(`Created BillingProduct ${RAZORPAY_BASE_PRODUCT_ID}`);
      } else if (
        productExists.metadata?.productKey !== BillingProductKey.BASE_PRODUCT ||
        productExists.metadata?.planKey !== BillingPlanKey.PRO
      ) {
        // Plan UI filters by metadata.productKey === BASE_PRODUCT
        await this.billingProductRepository.update(
          { stripeProductId: RAZORPAY_BASE_PRODUCT_ID },
          { metadata: RAZORPAY_BASE_PRODUCT_METADATA },
        );
        this.logger.log(
          `Backfilled metadata on BillingProduct ${RAZORPAY_BASE_PRODUCT_ID}`,
        );
      }
    }

    for (const plan of plans) {
      const stripePriceId = `razorpay_plan_${plan.id}`;
      const priceRow: Partial<BillingPriceEntity> = {
        stripePriceId,
        razorpayPlanId: plan.id,
        stripeProductId: RAZORPAY_BASE_PRODUCT_ID,
        active: true,
        currency: plan.item.currency,
        nickname: plan.item.name,
        taxBehavior: BillingPriceTaxBehavior.UNSPECIFIED,
        type: BillingPriceType.RECURRING,
        billingScheme: BillingPriceBillingScheme.PER_UNIT,
        usageType: BillingUsageType.LICENSED,
        interval: this.resolveRazorpaySubscriptionInterval(plan),
        recurring: this.resolveRazorpayRecurring(plan),
        unitAmount: plan.item.amount,
        unitAmountDecimal: String(plan.item.amount),
        metadata: {},
      };

      if (!options.dryRun) {
        await this.billingPriceRepository.upsert(priceRow, {
          conflictPaths: ['stripePriceId'],
        });
      }

      this.logger.log(
        `Upserted price ${stripePriceId} (Razorpay plan ${plan.id})`,
      );
    }
  }

  override async runMigrationCommand(
    _passedParams: string[],
    options: MigrationCommandOptions,
  ): Promise<void> {
    const provider = this.environmentService.get('BILLING_PROVIDER');

    if (provider === 'razorpay') {
      await this.syncRazorpayPlans(options);

      return;
    }

    if (this.ensureCatalog) {
      this.logger.log('Ensuring required Stripe billing catalog...');
      await this.billingStripeCatalogService.ensureRequiredCatalog({
        dryRun: options.dryRun,
      });
    }

    const billingMeters = await this.stripeBillingMeterService.getAllMeters();

    await this.upsertMetersRepositoryData(billingMeters, options);

    const billingProducts = await this.stripeProductService.getAllProducts();

    const billingPrices = await this.processBillingPricesByProductBatches(
      billingProducts,
      options,
    );
    const transformedPrices = billingPrices.flatMap((prices) =>
      prices.map((price) => transformStripePriceToDatabasePrice(price)),
    );

    this.logger.log(`Upserting ${transformedPrices.length} transformed prices`);

    if (!options.dryRun) {
      await this.billingPriceRepository.upsert(transformedPrices, {
        conflictPaths: ['stripePriceId'],
      });
    }

    if (this.ensureCatalog && options.dryRun !== true) {
      await this.billingStripeCatalogService.assertRequiredCatalogExistsInStripe();
    }
  }
}
