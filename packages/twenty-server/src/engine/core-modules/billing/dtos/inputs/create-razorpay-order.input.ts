/* @license Enterprise */

import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateRazorpayOrderInput {
  @Field()
  creditPackKey: string;
}
