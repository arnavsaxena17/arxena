/* @license Enterprise */

import { Field, InputType, Int } from '@nestjs/graphql';

import { AdminCreditType } from 'src/engine/core-modules/billing/enums/admin-credit-type.enum';

@InputType()
export class AdminAdjustWorkspaceCreditsInput {
  @Field()
  workspaceId: string;

  @Field(() => AdminCreditType)
  creditType: AdminCreditType;

  @Field(() => Int)
  delta: number;
}
