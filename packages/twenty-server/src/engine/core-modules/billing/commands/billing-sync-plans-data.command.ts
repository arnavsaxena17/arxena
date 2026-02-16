/* @license Enterprise */

import { InjectRepository } from '@nestjs/typeorm';

import { Command } from 'nest-commander';
import Stripe from 'stripe';
import { Repository } from 'typeorm';

import {
  BaseCommandOptions,
  BaseCommandRunner,
} from 'src/database/commands/base.command';
import { BillingMeter } from 'src/engine/core-modules/billing/entities/billing-meter.entity';
import { BillingPrice } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { BillingProduct } from 'src/engine/core-modules/billing/entities/billing-product.entity';
import { BillingPriceBillingScheme } from 'src/engine/core-modules/billing/enums/billing-price-billing-scheme.enum';
import { BillingPriceTaxBehavior } from 'src/engine/core-modules/billing/enums/billing-price-tax-behavior.enum';
import { BillingPriceType } from 'src/engine/core-modules/billing/enums/billing-price-type.enum';
import { BillingUsageType } from 'src/engine/core-modules/billing/enums/billing-usage-type.enum';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { StripeBillingMeterService } from 'src/engine/core-modules/billing/stripe/services/stripe-billing-meter.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { StripeProductService } from 'src/engine/core-modules/billing/stripe/services/stripe-product.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { isStripeValidProductMetadata } from 'src/engine/core-modules/billing/utils/is-stripe-valid-product-metadata.util';
import { transformStripeMeterToDatabaseMeter } from 'src/engine/core-modules/billing/utils/transform-stripe-meter-to-database-meter.util';
import { transformStripePriceToDatabasePrice } from 'src/engine/core-modules/billing/utils/transform-stripe-price-to-database-price.util';
import { transformStripeProductToDatabaseProduct } from 'src/engine/core-modules/billing/utils/transform-stripe-product-to-database-product.util';

const RAZORPAY_BASE_PRODUCT_ID = 'razorpay_base';

@Command({
  name: 'billing:sync-plans-data',
  description:
    'Fetches from Stripe or Razorpay the plans data and upserts it into the database',
})
export class BillingSyncPlansDataCommand extends BaseCommandRunner {
  private readonly batchSize = 5;
  constructor(
    @InjectRepository(BillingPrice, 'core')
    private readonly billingPriceRepository: Repository<BillingPrice>,
    @InjectRepository(BillingProduct, 'core')
    private readonly billingProductRepository: Repository<BillingProduct>,
    @InjectRepository(BillingMeter, 'core')
    private readonly billingMeterRepository: Repository<BillingMeter>,
    private readonly environmentService: EnvironmentService,
    private readonly stripeBillingMeterService: StripeBillingMeterService,
    private readonly stripeProductService: StripeProductService,
    private readonly stripePriceService: StripePriceService,
    private readonly razorpayPlanService: RazorpayPlanService,
  ) {
    super();
  }

  private async upsertMetersRepositoryData(
    meters: Stripe.Billing.Meter[],
    options: BaseCommandOptions,
  ) {
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
    });
  }

  private async upsertProductRepositoryData(
    product: Stripe.Product,
    options: BaseCommandOptions,
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
    options: BaseCommandOptions,
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
    options: BaseCommandOptions,
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

  private async syncRazorpayPlans(options: BaseCommandOptions): Promise<void> {
    const plans = await this.razorpayPlanService.getAllPlans();
    this.logger.log(`Fetched ${plans.length} Razorpay plans`);

    const productExists = await this.billingProductRepository.findOne({
      where: { stripeProductId: RAZORPAY_BASE_PRODUCT_ID },
    });
    if (!productExists && !options.dryRun) {
      await this.billingProductRepository.insert({
        stripeProductId: RAZORPAY_BASE_PRODUCT_ID,
        name: 'Razorpay Base',
        active: true,
        description: '',
        images: [],
        marketingFeatures: [],
        metadata: {},
      });
      this.logger.log(`Created BillingProduct ${RAZORPAY_BASE_PRODUCT_ID}`);
    }

    for (const plan of plans) {
      const stripePriceId = `razorpay_plan_${plan.id}`;
      const priceRow = {
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
        unitAmount: plan.item.amount,
        unitAmountDecimal: String(plan.item.amount),
      };
      if (!options.dryRun) {
        await this.billingPriceRepository.upsert(priceRow, {
          conflictPaths: ['stripePriceId'],
        });
      }
      this.logger.log(`Upserted price ${stripePriceId} (Razorpay plan ${plan.id})`);
    }
  }

  override async executeBaseCommand(
    passedParams: string[],
    options: BaseCommandOptions,
  ): Promise<void> {
    const provider = this.environmentService.get('BILLING_PROVIDER');
    if (provider === 'razorpay') {
      await this.syncRazorpayPlans(options);
      return;
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
  }
}
