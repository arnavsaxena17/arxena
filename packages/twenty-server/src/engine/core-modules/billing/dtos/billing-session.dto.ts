/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('BillingSession')
export class BillingSessionDTO {
  @Field(() => String, { nullable: true })
  url: string | null;

  @Field(() => String, { nullable: true })
  razorpaySubscriptionId?: string | null;

  @Field(() => String, { nullable: true })
  razorpayKeyId?: string | null;

  @Field(() => String, { nullable: true })
  razorpayCallbackUrl?: string | null;
}
