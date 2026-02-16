/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BillingSessionOutput {
  @Field(() => String, { nullable: true })
  url: string | null;

  /** For Razorpay Checkout (embed): subscription ID to pass to Razorpay.open() */
  @Field(() => String, { nullable: true })
  razorpaySubscriptionId: string | null;

  /** For Razorpay Checkout (embed): key ID for Razorpay.open() */
  @Field(() => String, { nullable: true })
  razorpayKeyId: string | null;

  /** For Razorpay Checkout (embed): callback_url for redirect after payment */
  @Field(() => String, { nullable: true })
  razorpayCallbackUrl: string | null;
}
