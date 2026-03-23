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

  @Field()
  orgChartCredits: number;

  @Field()
  emailContactCredits: number;

  @Field()
  phoneContactCredits: number;
}
