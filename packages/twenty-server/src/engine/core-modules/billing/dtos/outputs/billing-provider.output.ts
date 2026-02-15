/* @license Enterprise */

import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum BillingProviderEnum {
  stripe = 'stripe',
  razorpay = 'razorpay',
}

registerEnumType(BillingProviderEnum, { name: 'BillingProviderEnum' });

@ObjectType()
export class BillingProviderOutput {
  @Field(() => BillingProviderEnum)
  provider: BillingProviderEnum;
}
