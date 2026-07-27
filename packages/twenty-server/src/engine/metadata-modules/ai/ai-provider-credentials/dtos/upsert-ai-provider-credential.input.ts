import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpsertAiProviderCredentialInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  providerName: string;

  /**
   * When null, the credential is cleared (provider falls back to server-wide config).
   */
  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  apiKey?: string | null;
}

