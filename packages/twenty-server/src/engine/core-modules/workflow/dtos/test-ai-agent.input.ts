import { Field, InputType } from '@nestjs/graphql';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class TestAiAgentOutputValidationCheckInput {
  @IsString()
  @Field(() => String)
  id: string;

  @IsString()
  @Field(() => String)
  label: string;

  @IsString()
  @Field(() => String)
  instructions: string;

  @IsString()
  @Field(() => String)
  invalidWhen: string;

  @IsString()
  @Field(() => String)
  validWhen: string;
}

@InputType()
export class TestAiAgentOutputValidationInput {
  @IsBoolean()
  @Field(() => Boolean)
  enabled: boolean;

  @IsArray()
  @IsString({ each: true })
  @Field(() => [String])
  fieldKeys: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestAiAgentOutputValidationCheckInput)
  @Field(() => [TestAiAgentOutputValidationCheckInput], { nullable: true })
  checks?: TestAiAgentOutputValidationCheckInput[];
}

@InputType()
export class TestAiAgentInput {
  @IsString()
  @IsNotEmpty()
  @Field(() => UUIDScalarType, {
    description: 'Agent id to execute',
  })
  agentId: string;

  @IsString()
  @Field(() => String, {
    description:
      'Prompt to send to the agent. When candidateId is set, leave workflow chips in place so previous nodes can fill them.',
  })
  prompt: string;

  @IsOptional()
  @IsUUID()
  @Field(() => UUIDScalarType, {
    description:
      'Candidate to hydrate previous FIND / LinkedIn fetch nodes from before running the prompt',
    nullable: true,
  })
  candidateId?: string;

  @IsOptional()
  @IsUUID()
  @Field(() => UUIDScalarType, {
    description: 'Workflow version that owns the AI_AGENT step being tested',
    nullable: true,
  })
  workflowVersionId?: string;

  @IsOptional()
  @IsUUID()
  @Field(() => UUIDScalarType, {
    description: 'AI_AGENT step id whose previous nodes should be hydrated',
    nullable: true,
  })
  stepId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TestAiAgentOutputValidationInput)
  @Field(() => TestAiAgentOutputValidationInput, {
    description:
      'Jev checks to run on the structured output before it is returned',
    nullable: true,
  })
  outputValidation?: TestAiAgentOutputValidationInput;
}
