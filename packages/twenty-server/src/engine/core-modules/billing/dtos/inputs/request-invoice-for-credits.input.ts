/* @license Enterprise */

import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RequestInvoiceForCreditsInput {
  @Field()
  creditPackKey: string;

  @Field()
  companyName: string;

  @Field()
  billingAddress: string;

  @Field()
  billingEmail: string;

  @Field({ nullable: true })
  vatNumber?: string;

  @Field({ nullable: true })
  currency?: string;
}
