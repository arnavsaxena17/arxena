import { Field, InputType } from '@nestjs/graphql';

import { WorkflowActionType } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

@InputType()
export class CreateWorkflowVersionStepConnectionOptions {
  @Field(() => String, {
    description:
      'If/Else branch id the new step should be connected to (for IF_ELSE parents)',
    nullable: true,
  })
  branchId?: string;

  @Field(() => Boolean, {
    description:
      'Whether the new step is the entry point of an iterator loop body (for ITERATOR parents)',
    nullable: true,
  })
  isLoopEntry?: boolean;
}

@InputType()
export class CreateWorkflowVersionStepInput {
  @Field(() => String, {
    description: 'Workflow version ID',
    nullable: false,
  })
  workflowVersionId: string;

  @Field(() => String, {
    description: 'New step type',
    nullable: false,
  })
  stepType: WorkflowActionType;

  @Field(() => String, {
    description:
      'Id of the parent step (or "trigger") the new step is created from',
    nullable: true,
  })
  parentStepId?: string;

  @Field(() => String, {
    description:
      'Id of the step that currently follows the parent connection, so the new step is inserted in between',
    nullable: true,
  })
  nextStepId?: string;

  @Field(() => CreateWorkflowVersionStepConnectionOptions, {
    description: 'Additional options describing how the parent connection is made',
    nullable: true,
  })
  parentStepConnectionOptions?: CreateWorkflowVersionStepConnectionOptions;
}
