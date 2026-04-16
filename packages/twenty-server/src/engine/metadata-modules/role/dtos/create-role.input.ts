import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class CreateRoleInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  label: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}
