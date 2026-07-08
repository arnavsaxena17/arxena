import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WorkflowRuns')
export class WorkflowRunsDTO {
  @Field(() => [String], {
    description: 'Ids of the workflow runs that were created',
  })
  workflowRunIds: string[];
}
