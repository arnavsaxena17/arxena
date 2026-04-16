import { Field, InputType } from '@nestjs/graphql';

import {
    IsBoolean,
    IsOptional,
    IsString,
    IsUUID,
    ValidateIf,
} from 'class-validator';

import { isDefined } from 'twenty-shared';

@InputType()
export class UpdateRoleInput {
  @Field()
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => isDefined(value))
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canUpdateAllSettings?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canReadAllObjectRecords?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canUpdateAllObjectRecords?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canSoftDeleteAllObjectRecords?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  canDestroyAllObjectRecords?: boolean;
}
