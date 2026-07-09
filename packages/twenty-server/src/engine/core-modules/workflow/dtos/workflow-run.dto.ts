import { Field, ObjectType } from '@nestjs/graphql';

import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

@ObjectType('WorkflowRun')
export class WorkflowRunDTO {
  @Field(() => UUIDScalarType, { nullable: true })
  id?: string;

  @Field(() => UUIDScalarType, { nullable: true })
  workflowRunId?: string;

  @Field(() => WorkflowRunStatus, { nullable: true })
  status?: WorkflowRunStatus;
}
