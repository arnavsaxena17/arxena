import { WorkflowDiagramCreateStepConnectionOptions } from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { createState } from 'twenty-ui';

export type WorkflowCreateStepFromParent = {
  parentStepId: string;
  connectionOptions?: WorkflowDiagramCreateStepConnectionOptions;
};

export const workflowCreateStepFromParentStepIdState = createState<
  WorkflowCreateStepFromParent | undefined
>({
  key: 'workflowCreateStepFromParentStepId',
  defaultValue: undefined,
});
