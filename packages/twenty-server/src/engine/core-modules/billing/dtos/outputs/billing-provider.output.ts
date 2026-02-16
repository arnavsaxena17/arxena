/* @license Enterprise */

import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum BillingProviderEnum {
  razorpay = 'razorpay',
  stripe = 'stripe',
}

registerEnumType(BillingProviderEnum, {
  name: 'BillingProviderEnum',
});

@ObjectType()
export class BillingProviderOutput {
  @Field(() => BillingProviderEnum)
  provider: BillingProviderEnum;
}
