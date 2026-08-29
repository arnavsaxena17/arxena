import { getWorkflowVisualizerComponentInstanceId } from '@/workflow/utils/getWorkflowVisualizerComponentInstanceId';
import { WorkflowDiagramCanvasEditable } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasEditable';
import { WorkflowDiagramEffect } from '@/workflow/workflow-diagram/components/WorkflowDiagramEffect';
import { WorkflowSSESubscribeEffect } from '@/workflow/workflow-diagram/components/WorkflowSSESubscribeEffect';
import { WorkflowVisualizerEffect } from '@/workflow/workflow-diagram/components/WorkflowVisualizerEffect';
import { WorkflowVisualizerComponentInstanceContext } from '@/workflow/workflow-diagram/states/contexts/WorkflowVisualizerComponentInstanceContext';

type OutreachWorkflowDiagramEmbedProps = {
  workflowId: string;
};

export const OutreachWorkflowDiagramEmbed = ({
  workflowId,
}: OutreachWorkflowDiagramEmbedProps) => {
  return (
    <WorkflowVisualizerComponentInstanceContext.Provider
      // Remount on switch — draft transitions otherwise merge the previous graph in.
      key={workflowId}
      value={{
        instanceId: getWorkflowVisualizerComponentInstanceId({
          recordId: workflowId,
        }),
      }}
    >
      <WorkflowVisualizerEffect workflowId={workflowId} />
      <WorkflowSSESubscribeEffect workflowId={workflowId} />
      <WorkflowDiagramEffect />
      <WorkflowDiagramCanvasEditable />
    </WorkflowVisualizerComponentInstanceContext.Provider>
  );
};
