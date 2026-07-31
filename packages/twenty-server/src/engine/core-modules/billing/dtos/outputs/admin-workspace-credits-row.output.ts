/* @license Enterprise */

import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminWorkspaceCreditsRowOutput {
  @Field()
  workspaceId: string;

  @Field(() => GraphQLISODateTime)
  workspaceCreatedAt: Date;

  @Field()
  workspaceName: string;

  @Field(() => String, { nullable: true })
  workspaceCreatorEmail?: string | null;

  @Field()
  orgChartCredits: number;

  @Field()
  revealCredits: number;

  @Field()
  apiCredits: number;

  // Display AI credits from billingCustomer.creditBalanceMicro
  @Field()
  aiCredits: number;
}
