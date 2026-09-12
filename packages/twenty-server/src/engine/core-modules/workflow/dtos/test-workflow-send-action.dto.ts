import { Field, ObjectType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

@ObjectType('TestWorkflowSendAction')
export class TestWorkflowSendActionDTO {
  @Field(() => Boolean, {
    description: 'Whether the send completed successfully',
  })
  success: boolean;

  @Field(() => String, {
    description: 'Message describing the result',
  })
  message: string;

  @Field(() => graphqlTypeJson, {
    description: 'Provider / tool result payload',
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
}
