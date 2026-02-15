/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WorkspaceCreditsOutput {
  @Field()
  credits: number;
}
