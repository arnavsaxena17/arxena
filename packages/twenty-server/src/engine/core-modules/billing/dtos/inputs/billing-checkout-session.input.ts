/* @license Enterprise */

import { ArgsType, Field } from '@nestjs/graphql';

import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';

@ArgsType()
export class BillingCheckoutSessionInput {
  @Field(() => SubscriptionInterval)
  @IsEnum(SubscriptionInterval)
  @IsNotEmpty()
  recurringInterval: SubscriptionInterval;

  @Field(() => BillingPlanKey, { defaultValue: BillingPlanKey.PRO })
  @IsEnum(BillingPlanKey)
  @IsOptional()
  plan?: BillingPlanKey;

  @Field(() => Boolean, { defaultValue: true })
  @IsBoolean()
  @IsOptional()
  requirePaymentMethod?: boolean;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  successUrlPath?: string;

  /** Full URL to redirect to after payment (e.g. https://subdomain.localhost:3001/settings/billing). When set, used for Razorpay callback so user returns to the same origin/subdomain. */
  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  successReturnUrl?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Razorpay plan id for subscription checkout (when provider is razorpay)',
  })
  @IsString()
  @IsOptional()
  razorpayPlanId?: string;
}
