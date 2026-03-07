/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminWorkspaceCreditsRowOutput {
  @Field()
  workspaceId: string;

  @Field()
  workspaceName: string;

  @Field()
  orgChartCredits: number;

  @Field()
  emailContactCredits: number;

  @Field()
  phoneContactCredits: number;
}
