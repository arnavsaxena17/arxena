/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CreditPackOutput {
  @Field()
  key: string;

  @Field()
  name: string;

  @Field()
  credits: number;

  @Field()
  amountSubunits: number;

  @Field()
  currency: string;

  @Field()
  planId: string;

  @Field()
  intent: string;

  @Field()
  mapsCount: number;

  @Field()
  mapType: string;

  @Field()
  mapTypeLabel: string;

  @Field()
  tagline: string;

  @Field(() => String, { nullable: true })
  inheritedFromPlanId?: string | null;

  @Field(() => [String])
  ownFeatures: string[];

  @Field()
  includedEmailCredits: number;

  @Field()
  includedPhoneCredits: number;

  @Field()
  creditsDisplay: string;

  /** JSON-stringified Record<SupportedPricingCurrency, number>. */
  @Field()
  pricesSubunitsJson: string;
}
