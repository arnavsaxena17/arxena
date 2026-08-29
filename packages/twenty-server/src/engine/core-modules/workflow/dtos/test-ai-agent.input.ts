import { Field, InputType } from '@nestjs/graphql';

import { IsNotEmpty, IsString } from 'class-validator';

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
      'Prompt to send to the agent, with workflow variables already substituted',
  })
  prompt: string;
}
