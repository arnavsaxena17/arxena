/* @license Enterprise */

import { ArgsType, Field } from '@nestjs/graphql';

import { IsOptional, IsString } from 'class-validator';

@ArgsType()
export class CreateRazorpayOrderForCreditsInput {
  @Field()
  @IsString()
  creditPackKey: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  currency?: string;
}
