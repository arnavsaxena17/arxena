import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

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
}
