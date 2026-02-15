/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CreditPackOutput {
  @Field()
  key: string;

  @Field()
  name: string;

  @Field()
  credits: number;

  @Field()
  amountSubunits: number;

  @Field()
  currency: string;
}
