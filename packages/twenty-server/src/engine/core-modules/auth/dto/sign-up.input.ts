import { ArgsType, Field } from '@nestjs/graphql';

import {
    IsBoolean,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';
import { APP_LOCALES } from 'twenty-shared';

@ArgsType()
export class SignUpInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  password: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  workspaceId?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  workspaceInviteHash?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  workspacePersonalInviteToken?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  captchaToken?: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  locale?: keyof typeof APP_LOCALES;

  @Field(() => String, { nullable: true })
  @IsUUID()
  @IsOptional()
  consentVisitorId?: string;

  @Field(() => Boolean, { nullable: true })
  @IsBoolean()
  @IsOptional()
  termsAccepted?: boolean;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  privacyPolicyVersion?: string;
}
