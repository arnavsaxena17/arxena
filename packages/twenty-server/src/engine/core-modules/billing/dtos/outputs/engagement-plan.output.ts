/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class EngagementPlanOutput {
  @Field()
  intervalKey: string;

  @Field()
  name: string;

  @Field()
  amountSubunits: number;

  @Field()
  currency: string;

  @Field(() => String, { nullable: true })
  planId: string | null;
}
