import { Field, ObjectType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@ObjectType('TestWorkflowFormNotifySendResult')
export class TestWorkflowFormNotifySendResultDTO {
  @Field(() => String)
  channel: string;

  @Field(() => String)
  status: string;

  @Field(() => String, { nullable: true })
  detail?: string;
}

@ObjectType('TestWorkflowFormNotify')
export class TestWorkflowFormNotifyDTO {
  @Field(() => UUIDScalarType)
  testId: string;

  @Field(() => String)
  status: string;

  @Field(() => String)
  pointer: string;

  @Field(() => String, { nullable: true })
  fillUrl?: string;

  @Field(() => [TestWorkflowFormNotifySendResultDTO])
  sendResults: TestWorkflowFormNotifySendResultDTO[];

  @Field(() => graphqlTypeJson, { nullable: true })
  capturedResponse?: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  error?: string;
}
