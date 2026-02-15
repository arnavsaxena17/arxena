/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RazorpayOrderForCreditsOutput {
  @Field()
  orderId: string;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field()
  keyId: string;

  @Field()
  creditPackKey: string;

  @Field()
  credits: number;
}
