import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpsertOrgChartClientIpRuleInput {
  @Field()
  ipAddress: string;

  @Field()
  isBlocked: boolean;

  @Field()
  serveCachedOnly: boolean;
}
