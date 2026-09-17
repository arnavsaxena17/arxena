import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('BulkForceStopWorkflowRuns')
export class BulkForceStopWorkflowRunsDTO {
  @Field(() => Int)
  stoppedCount: number;
}
