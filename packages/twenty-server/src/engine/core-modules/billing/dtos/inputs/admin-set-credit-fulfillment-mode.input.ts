/* @license Enterprise */

import { Field, InputType } from '@nestjs/graphql';

import { CreditFulfillmentMode } from 'src/engine/core-modules/billing/enums/credit-fulfillment-mode.enum';

@InputType()
export class AdminSetCreditFulfillmentModeInput {
  @Field()
  workspaceId: string;

  @Field(() => CreditFulfillmentMode)
  mode: CreditFulfillmentMode;
}
