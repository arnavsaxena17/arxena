import { Field, InputType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import graphqlTypeJson from 'graphql-type-json';

@InputType()
export class TestWorkflowAiFilteringFieldInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Field(() => String)
  type: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  enumValues?: string[];
}

@InputType()
export class TestWorkflowAiFilteringInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => String, {
    description: 'Filter prompt / criteria',
  })
  prompt: string;

  @IsOptional()
  @IsString()
  @Field(() => String, {
    nullable: true,
    description: 'Model id (defaults to typesafe-ai/jev)',
  })
  selectedModel?: string;

  @IsOptional()
  @IsString()
  @Field(() => String, { nullable: true })
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  selectedMetadataFields?: string[];

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  includeResume?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestWorkflowAiFilteringFieldInput)
  @Field(() => [TestWorkflowAiFilteringFieldInput])
  fields: TestWorkflowAiFilteringFieldInput[];

  @IsOptional()
  @Field(() => graphqlTypeJson, {
    nullable: true,
    description: 'Optional sample candidates; server fixture used when omitted',
  })
  candidates?: unknown;
}
