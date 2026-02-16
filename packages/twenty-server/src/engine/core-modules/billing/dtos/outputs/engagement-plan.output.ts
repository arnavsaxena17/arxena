/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EngagementPlanOutput {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  amount: number;

  @Field()
  currency: string;

  @Field()
  period: string;

  @Field()
  interval: number;
}
