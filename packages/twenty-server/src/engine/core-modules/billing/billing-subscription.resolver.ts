/* @license Enterprise */

import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { BillingPrice } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';

@Resolver(() => BillingSubscription)
export class BillingSubscriptionResolver {
  constructor(
    private readonly razorpayPlanService: RazorpayPlanService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
    @InjectRepository(BillingPrice, 'core')
    private readonly billingPriceRepository: Repository<BillingPrice>,
  ) {}

  @ResolveField(() => String, { nullable: true })
  async planName(
    @Parent() subscription: BillingSubscription,
  ): Promise<string | null> {
    const full =
      subscription.razorpaySubscriptionId != null
        ? subscription
        : await this.billingSubscriptionRepository.findOne({
            where: { id: subscription.id },
            select: ['id', 'razorpaySubscriptionId'],
          });
    const razorpaySubscriptionId = full?.razorpaySubscriptionId ?? null;
    if (!razorpaySubscriptionId) {
      return null;
    }
    const planId =
      await this.razorpayPlanService.getSubscriptionPlanId(
        razorpaySubscriptionId,
      );
    if (!planId) {
      return null;
    }
    const price = await this.billingPriceRepository.findOne({
      where: { razorpayPlanId: planId },
    });
    if (price?.nickname) {
      return price.nickname;
    }
    return this.razorpayPlanService.getPlanName(planId);
  }
}
