import { WorkflowContext } from '@/workflow/workflow-diagram/types/WorkflowContext';
import { WorkflowDiagramEdgeType } from '@/workflow/workflow-diagram/types/WorkflowDiagram';

export const getEdgeTypeBetweenTwoNodes = (_: {
  workflowContext: WorkflowContext;
}): WorkflowDiagramEdgeType => {
  return 'default';
};
