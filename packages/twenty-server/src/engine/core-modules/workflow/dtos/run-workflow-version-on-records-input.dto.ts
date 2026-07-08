import { Field, InputType } from '@nestjs/graphql';

import graphqlTypeJson from 'graphql-type-json';

@InputType()
export class RunWorkflowVersionOnRecordsInput {
  @Field(() => String, {
    description: 'Workflow version ID',
    nullable: false,
  })
  workflowVersionId: string;

  @Field(() => [graphqlTypeJson], {
    description: 'One payload per record to enroll (fan-out, one run per record)',
    nullable: false,
  })
  payloads: JSON[];
}
