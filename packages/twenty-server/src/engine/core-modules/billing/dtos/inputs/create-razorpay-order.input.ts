/* @license Enterprise */

import { Field, InputType } from '@nestjs/graphql';
import { type SupportedPricingCurrency } from 'twenty-shared';

@InputType()
export class CreateRazorpayOrderInput {
  @Field()
  creditPackKey: string;

  @Field(() => String, { nullable: true })
  currency?: SupportedPricingCurrency;
}
