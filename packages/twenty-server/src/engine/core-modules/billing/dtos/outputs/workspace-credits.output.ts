/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WorkspaceCreditsOutput {
  @Field()
  orgChartCredits: number;

  @Field()
  revealCredits: number;

  /** floor(revealCredits / getRevealCost('email')) — display only. */
  @Field()
  revealCreditsAsEmailEquivalent: number;

  /** floor(revealCredits / getRevealCost('phone')) — display only. */
  @Field()
  revealCreditsAsPhoneEquivalent: number;

  /** getRevealCost('email') — runtime-resolved. */
  @Field()
  emailRevealCost: number;

  /** getRevealCost('phone') — runtime-resolved. */
  @Field()
  phoneRevealCost: number;
}
