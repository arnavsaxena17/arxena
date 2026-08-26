import { WorkflowStepBody } from '@/workflow/workflow-steps/components/WorkflowStepBody';

const WorkflowRunStepJsonContainerInner = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <WorkflowStepBody
    display="grid"
    gridTemplateColumns="minmax(0, 1fr)"
    gridTemplateRows="max-content"
    rowGap="0"
    overflow="auto"
  >
    {children}
  </WorkflowStepBody>
);

export { WorkflowRunStepJsonContainerInner as WorkflowRunStepJsonContainer };
