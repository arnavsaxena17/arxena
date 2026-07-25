/* @license Enterprise */

import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RequestInvoiceForCreditsOutput {
  @Field()
  success: boolean;
}
