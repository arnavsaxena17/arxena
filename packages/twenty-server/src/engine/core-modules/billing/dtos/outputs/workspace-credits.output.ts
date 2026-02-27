/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WorkspaceCreditsOutput {
  @Field()
  orgChartCredits: number;

  @Field()
  emailContactCredits: number;

  @Field()
  phoneContactCredits: number;
}
