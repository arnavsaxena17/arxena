import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export type WorkflowIteratorActionInput = {
  // `object[]` (not `unknown[]`) so this type stays assignable to TypeORM's
  // `(Query)DeepPartialEntity` when it is reached through the WorkflowRun
  // entity graph (in this codebase `Relation<T> = T`, so an `unknown` leaf here
  // would break every `.insert()`/`.save()` reaching a workflow entity).
  items?: object[] | string;
  initialLoopStepIds?: string[];
  shouldContinueOnIterationFailure?: boolean;
};

export type WorkflowIteratorActionSettings = BaseWorkflowActionSettings & {
  input: WorkflowIteratorActionInput;
};
