/* @license Enterprise */

import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AdminSetBillingTreatmentOverrideInput {
  @Field()
  workspaceId: string;

  @Field()
  feature: string;

  // CUSTOMER, SYSTEM, INTERNAL or OFF. Omit to return the feature to its default.
  @Field(() => String, { nullable: true })
  treatment?: string | null;
}
