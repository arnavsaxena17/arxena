import { Field, ObjectType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

@ObjectType('TestAiAgent')
export class TestAiAgentDTO {
  @Field(() => Boolean, {
    description: 'Whether the agent ran successfully',
  })
  success: boolean;

  @Field(() => String, {
    description: 'Message describing the result',
  })
  message: string;

  @Field(() => graphqlTypeJson, {
    description: 'Agent output',
    nullable: true,
  })
  result?: object | null;

  @Field(() => String, {
    description: 'Error information',
    nullable: true,
  })
  error?: string;

  @Field(() => Number, {
    description: 'Execution duration in milliseconds',
    nullable: true,
  })
  durationMs?: number;

  @Field(() => graphqlTypeJson, {
    description:
      'Jev field checks from the last draft attempt, when output validation is enabled',
    nullable: true,
  })
  outputValidation?: object | null;
}
