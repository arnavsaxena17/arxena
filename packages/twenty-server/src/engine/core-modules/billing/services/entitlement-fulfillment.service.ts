/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';
import {
  aiCreditsToMicro,
  FREE_SIGNUP_AI_CREDITS,
  type CreditPack,
} from 'twenty-shared';
import { isDefined } from 'twenty-shared/utils';

import { BillingCustomerEntity } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingPriceEntity } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { BillingProductEntity } from 'src/engine/core-modules/billing/entities/billing-product.entity';
import { BillingSubscriptionItemEntity } from 'src/engine/core-modules/billing/entities/billing-subscription-item.entity';
import { BillingSubscriptionEntity } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { BillingPriceBillingScheme } from 'src/engine/core-modules/billing/enums/billing-price-billing-scheme.enum';
import { BillingPriceTaxBehavior } from 'src/engine/core-modules/billing/enums/billing-price-tax-behavior.enum';
import { BillingPriceType } from 'src/engine/core-modules/billing/enums/billing-price-type.enum';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import { BillingUsageType } from 'src/engine/core-modules/billing/enums/billing-usage-type.enum';
import { CreditFulfillmentMode } from 'src/engine/core-modules/billing/enums/credit-fulfillment-mode.enum';
import { BillingCreditService } from 'src/engine/core-modules/billing/services/billing-credit.service';
import { BillingUsageCacheService } from 'src/engine/core-modules/billing/services/billing-usage-cache.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

const RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID = 'razorpay_resource_credit';

type FulfillOneTimeInput = {
  workspaceId: string;
  sku: CreditPack;
  paymentId: string;
};

type FulfillSubscriptionCycleInput = {
  workspaceId: string;
  sku: CreditPack;
  periodStart: Date;
  razorpayEventId: string;
};

@Injectable()
export class EntitlementFulfillmentService {
  private readonly logger = new Logger(EntitlementFulfillmentService.name);

  constructor(
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly billingCreditService: BillingCreditService,
    private readonly creditTransactionService: CreditTransactionService,
    private readonly billingUsageCacheService: BillingUsageCacheService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(BillingSubscriptionEntity)
    private readonly billingSubscriptionRepository: Repository<BillingSubscriptionEntity>,
    @InjectRepository(BillingSubscriptionItemEntity)
    private readonly billingSubscriptionItemRepository: Repository<BillingSubscriptionItemEntity>,
    @InjectRepository(BillingProductEntity)
    private readonly billingProductRepository: Repository<BillingProductEntity>,
    @InjectRepository(BillingPriceEntity)
    private readonly billingPriceRepository: Repository<BillingPriceEntity>,
    @InjectRepository(BillingCustomerEntity)
    private readonly billingCustomerRepository: Repository<BillingCustomerEntity>,
  ) {}

  async fulfillOneTimePack(input: FulfillOneTimeInput): Promise<boolean> {
    const { workspaceId, sku, paymentId } = input;
    const idempotencyKey = `payment:${paymentId}`;

    if (
      await this.creditTransactionService.hasFulfillmentIdempotencyKey(
        workspaceId,
        idempotencyKey,
      )
    ) {
      this.logger.log(
        `Skipping one-time fulfillment (already applied): ${idempotencyKey}`,
      );

      return false;
    }

    // One-time packs always ADD, regardless of workspace fulfillment mode
    await this.applyArxenaPools({
      workspaceId,
      maps: sku.mapsCount,
      reveals: sku.credits,
      apiCredits: sku.apiCredits,
      mode: 'add',
      idempotencyKey,
      skuKey: sku.key,
      source: 'one_time_pack',
    });

    if (sku.aiCredits > 0) {
      await this.grantAiBalance({
        workspaceId,
        aiCredits: sku.aiCredits,
        idempotencyKey,
        skuKey: sku.key,
        source: 'one_time_pack',
      });
    }

    return true;
  }

  async fulfillSubscriptionCycle(
    input: FulfillSubscriptionCycleInput,
  ): Promise<boolean> {
    const { workspaceId, sku, periodStart, razorpayEventId } = input;
    const idempotencyKey = `subscription:${razorpayEventId}:${periodStart.toISOString()}`;

    if (
      await this.creditTransactionService.hasFulfillmentIdempotencyKey(
        workspaceId,
        idempotencyKey,
      )
    ) {
      this.logger.log(
        `Skipping subscription fulfillment (already applied): ${idempotencyKey}`,
      );

      return false;
    }

    const mode = await this.getFulfillmentMode(workspaceId);
    const mapsRevealsMode =
      mode === CreditFulfillmentMode.ADD || mode === CreditFulfillmentMode.SPLIT
        ? 'add'
        : 'reset';
    const aiMode =
      mode === CreditFulfillmentMode.ADD ? 'balance' : 'resource_credit';

    await this.applyArxenaPools({
      workspaceId,
      maps: sku.mapsCount,
      reveals: sku.credits,
      apiCredits: sku.apiCredits,
      mode: mapsRevealsMode,
      idempotencyKey,
      skuKey: sku.key,
      source: 'subscription_cycle',
    });

    if (aiMode === 'balance') {
      await this.ensureResourceCreditCap({ workspaceId, aiCredits: 0 });
      if (sku.aiCredits > 0) {
        await this.grantAiBalance({
          workspaceId,
          aiCredits: sku.aiCredits,
          idempotencyKey,
          skuKey: sku.key,
          source: 'subscription_cycle',
        });
      }
    } else {
      await this.ensureResourceCreditCap({
        workspaceId,
        aiCredits: sku.aiCredits,
      });
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'credit',
        creditType: 'ai_top_up',
        amount: sku.aiCredits,
        metadata: {
          idempotencyKey,
          skuKey: sku.key,
          source: 'subscription_cycle',
          grantPath: 'resource_credit',
          creditAmountMicro: aiCreditsToMicro(sku.aiCredits),
        },
      });
    }

    await this.billingUsageCacheService.flushAvailableCredits(workspaceId);

    return true;
  }

  async grantSignupAiCredits(workspaceId: string): Promise<void> {
    const idempotencyKey = 'signup_ai_grant';

    if (
      await this.creditTransactionService.hasFulfillmentIdempotencyKey(
        workspaceId,
        idempotencyKey,
      )
    ) {
      return;
    }

    await this.grantAiBalance({
      workspaceId,
      aiCredits: FREE_SIGNUP_AI_CREDITS,
      idempotencyKey,
      skuKey: 'signup',
      source: 'signup_ai_grant',
    });
  }

  async getFulfillmentMode(
    workspaceId: string,
  ): Promise<CreditFulfillmentMode> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: { id: true, creditFulfillmentMode: true },
    });
    const mode = workspace?.creditFulfillmentMode;

    if (mode === 'add') {
      return CreditFulfillmentMode.ADD;
    }
    if (mode === 'split') {
      return CreditFulfillmentMode.SPLIT;
    }

    return CreditFulfillmentMode.RESET;
  }

  async setFulfillmentMode(
    workspaceId: string,
    mode: CreditFulfillmentMode,
  ): Promise<void> {
    await this.workspaceRepository.update(
      { id: workspaceId },
      { creditFulfillmentMode: mode },
    );
  }

  private async applyArxenaPools({
    workspaceId,
    maps,
    reveals,
    apiCredits,
    mode,
    idempotencyKey,
    skuKey,
    source,
  }: {
    workspaceId: string;
    maps: number;
    reveals: number;
    apiCredits: number;
    mode: 'add' | 'reset';
    idempotencyKey: string;
    skuKey: string;
    source: string;
  }): Promise<void> {
    await this.workspaceCreditsService.getOrCreate(workspaceId);

    if (mode === 'reset') {
      await this.workspaceCreditsService.setOrgChartCredits(workspaceId, maps);
      await this.workspaceCreditsService.setRevealCredits(workspaceId, reveals);
      await this.workspaceCreditsService.setApiCredits(workspaceId, apiCredits);
    } else {
      if (maps > 0) {
        await this.workspaceCreditsService.addOrgChartCredits(workspaceId, maps);
      }
      if (reveals > 0) {
        await this.workspaceCreditsService.addRevealCredits(
          workspaceId,
          reveals,
        );
      }
      if (apiCredits > 0) {
        await this.workspaceCreditsService.addApiCredits(
          workspaceId,
          apiCredits,
        );
      }
    }

    if (maps > 0 || mode === 'reset') {
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'credit',
        creditType: 'org_chart',
        amount: maps,
        metadata: {
          idempotencyKey,
          skuKey,
          source,
          fulfillMode: mode,
        },
      });
    }

    if (reveals > 0 || mode === 'reset') {
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'credit',
        creditType: 'reveal_top_up',
        amount: reveals,
        metadata: {
          idempotencyKey,
          skuKey,
          source,
          fulfillMode: mode,
        },
      });
    }

    if (apiCredits > 0 || mode === 'reset') {
      await this.creditTransactionService.recordTransaction({
        workspaceId,
        type: 'credit',
        creditType: 'api_top_up',
        amount: apiCredits,
        metadata: {
          idempotencyKey,
          skuKey,
          source,
          fulfillMode: mode,
        },
      });
    }
  }

  private async grantAiBalance({
    workspaceId,
    aiCredits,
    idempotencyKey,
    skuKey,
    source,
  }: {
    workspaceId: string;
    aiCredits: number;
    idempotencyKey: string;
    skuKey: string;
    source: string;
  }): Promise<void> {
    const amountMicro = aiCreditsToMicro(aiCredits);

    if (amountMicro <= 0) {
      return;
    }

    // Ensure billing customer exists so creditWorkspaceBalance can increment
    await this.billingCustomerRepository.upsert(
      {
        workspaceId,
        paymentProvider: 'razorpay',
        stripeCustomerId: null,
      },
      {
        conflictPaths: ['workspaceId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    await this.billingCreditService.creditWorkspaceBalance({
      workspaceId,
      amountMicro,
    });

    await this.creditTransactionService.recordTransaction({
      workspaceId,
      type: 'credit',
      creditType: 'ai_top_up',
      amount: aiCredits,
      metadata: {
        idempotencyKey,
        skuKey,
        source,
        grantPath: 'credit_balance_micro',
        creditAmountMicro: amountMicro,
      },
    });
  }

  // Ensures a RESOURCE_CREDIT product/price/item so period AI cap matches aiCredits
  async ensureResourceCreditCap({
    workspaceId,
    aiCredits,
  }: {
    workspaceId: string;
    aiCredits: number;
  }): Promise<void> {
    const creditAmountMicro = aiCreditsToMicro(aiCredits);
    const stripePriceId = `razorpay_resource_credit_${creditAmountMicro}`;

    let product = await this.billingProductRepository.findOne({
      where: { stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID },
    });

    if (!isDefined(product)) {
      await this.billingProductRepository.insert({
        stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID,
        name: 'Razorpay Resource Credits',
        active: true,
        description: 'AI / workflow usage credits for Razorpay workspaces',
        images: [],
        marketingFeatures: [],
        metadata: {
          productKey: BillingProductKey.RESOURCE_CREDIT,
          planKey: BillingPlanKey.PRO,
          priceUsageBased: BillingUsageType.LICENSED,
        },
      });
      product = await this.billingProductRepository.findOneOrFail({
        where: { stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID },
      });
    }

    let price = await this.billingPriceRepository.findOne({
      where: { stripePriceId },
    });

    if (!isDefined(price)) {
      await this.billingPriceRepository.insert({
        stripePriceId,
        stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID,
        razorpayPlanId: null,
        active: true,
        currency: 'usd',
        nickname: `AI ${aiCredits} credits`,
        taxBehavior: BillingPriceTaxBehavior.UNSPECIFIED,
        type: BillingPriceType.RECURRING,
        billingScheme: BillingPriceBillingScheme.PER_UNIT,
        usageType: BillingUsageType.LICENSED,
        interval: SubscriptionInterval.Month,
        recurring: {
          interval: 'month',
          interval_count: 1,
          usage_type: 'licensed',
          meter: null,
          trial_period_days: null,
        },
        unitAmount: 0,
        unitAmountDecimal: '0',
        metadata: {
          credit_amount: String(creditAmountMicro),
        },
      });
      price = await this.billingPriceRepository.findOneOrFail({
        where: { stripePriceId },
      });
    } else if (
      Number(price.metadata?.credit_amount ?? 0) !== creditAmountMicro
    ) {
      await this.billingPriceRepository.update(
        { stripePriceId },
        {
          metadata: {
            ...price.metadata,
            credit_amount: String(creditAmountMicro),
          },
        },
      );
    }

    const activeStatuses = [
      SubscriptionStatus.Active,
      SubscriptionStatus.Trialing,
      SubscriptionStatus.PastDue,
    ];

    const subscription = await this.billingSubscriptionRepository.findOne({
      where: {
        workspaceId,
        status: In(activeStatuses),
      },
      order: { createdAt: 'DESC' },
    });

    if (!isDefined(subscription)) {
      this.logger.warn(
        `No active subscription for workspace ${workspaceId}; skipped RESOURCE_CREDIT item`,
      );

      return;
    }

    const existingItem = await this.billingSubscriptionItemRepository.findOne({
      where: {
        billingSubscriptionId: subscription.id,
        stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID,
      },
    });

    const stripeSubscriptionItemId = `razorpay_rc_item_${subscription.id}`;

    if (isDefined(existingItem)) {
      await this.billingSubscriptionItemRepository.update(
        { id: existingItem.id },
        {
          stripePriceId,
          hasReachedCurrentPeriodCap: false,
        },
      );
    } else {
      await this.billingSubscriptionItemRepository.insert({
        billingSubscriptionId: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeProductId: RAZORPAY_RESOURCE_CREDIT_PRODUCT_ID,
        stripePriceId,
        stripeSubscriptionItemId,
        quantity: 1,
        metadata: {},
        hasReachedCurrentPeriodCap: false,
      });
    }
  }
}
