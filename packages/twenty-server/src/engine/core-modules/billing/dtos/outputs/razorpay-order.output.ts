/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RazorpayOrderOutput {
  @Field()
  orderId: string;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field()
  keyId: string;
}
