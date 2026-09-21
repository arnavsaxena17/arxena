import { Field, ObjectType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

@ObjectType('TestWorkflowAiFiltering')
export class TestWorkflowAiFilteringDTO {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => graphqlTypeJson, { nullable: true })
  result?: object | null;

  @Field(() => String, { nullable: true })
  error?: string;

  @Field(() => Number, { nullable: true })
  durationMs?: number;
}
