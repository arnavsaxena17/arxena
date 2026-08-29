import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { useActivateWorkflowVersion } from '@/workflow/hooks/useActivateWorkflowVersion';
import { usePublishExperimentVersion } from '@/workflow/hooks/usePublishExperimentVersion';
import { useWorkflowWithCurrentVersion } from '@/workflow/hooks/useWorkflowWithCurrentVersion';
import { workflowVisualizerWorkflowIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowIdComponentState';
import { WorkflowDiagramCanvasBase } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasBase';
import { WorkflowDiagramCanvasEditableEffect } from '@/workflow/workflow-diagram/components/WorkflowDiagramCanvasEditableEffect';
import { useStartNodeCreation } from '@/workflow/workflow-diagram/hooks/useStartNodeCreation';
import { workflowDiagramComponentState } from '@/workflow/workflow-diagram/states/workflowDiagramComponentState';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import {
  type WorkflowConnection,
  type WorkflowDiagramEdge,
  type WorkflowDiagramNode,
} from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { assertEdgeHasDefinedHandlesOrThrow } from '@/workflow/workflow-diagram/utils/assertEdgeHasDefinedHandlesOrThrow';
import { assertWorkflowConnectionOrThrow } from '@/workflow/workflow-diagram/utils/assertWorkflowConnectionOrThrow';
import { getWorkflowVersionStatusTagProps } from '@/workflow/workflow-diagram/utils/getWorkflowVersionStatusTagProps';
import { WorkflowDiagramBlankEdge } from '@/workflow/workflow-diagram/workflow-edges/components/WorkflowDiagramBlankEdge';
import { WorkflowDiagramDefaultEdgeEditable } from '@/workflow/workflow-diagram/workflow-edges/components/WorkflowDiagramDefaultEdgeEditable';
import { getConnectionOptionsForSourceHandle } from '@/workflow/workflow-diagram/workflow-edges/utils/getConnectionOptionsForSourceHandle';
import { WorkflowDiagramEmptyTriggerEditable } from '@/workflow/workflow-diagram/workflow-nodes/components/WorkflowDiagramEmptyTriggerEditable';
import { WorkflowDiagramStepNodeEditable } from '@/workflow/workflow-diagram/workflow-nodes/components/WorkflowDiagramStepNodeEditable';
import { useCreateEdge } from '@/workflow/workflow-steps/hooks/useCreateEdge';
import { useDeleteEdge } from '@/workflow/workflow-steps/hooks/useDeleteEdge';
import { useUpdateStep } from '@/workflow/workflow-steps/hooks/useUpdateStep';
import { prepareIfElseStepWithNewBranch } from '@/workflow/workflow-steps/workflow-actions/if-else-action/utils/prepareIfElseStepWithNewBranch';
import { useUpdateWorkflowVersionTrigger } from '@/workflow/workflow-trigger/hooks/useUpdateWorkflowVersionTrigger';
import { styled } from '@linaria/react';
import {
  addEdge,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type OnNodeDrag,
} from '@xyflow/react';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledAbSubtitle = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
`;

export const WorkflowDiagramCanvasEditable = () => {
  const workflowVisualizerWorkflowId = useAtomComponentStateValue(
    workflowVisualizerWorkflowIdComponentState,
  );

  const workflowWithCurrentVersion = useWorkflowWithCurrentVersion(
    workflowVisualizerWorkflowId,
  );

  const setWorkflowDiagram = useSetAtomComponentState(
    workflowDiagramComponentState,
  );

  const setWorkflowDiagramRightClickMenuPosition = useSetAtomComponentState(
    workflowDiagramRightClickMenuPositionState,
  );

  const { createEdge } = useCreateEdge();

  const { deleteEdge } = useDeleteEdge();

  const { updateStep } = useUpdateStep();

  const { updateTrigger } = useUpdateWorkflowVersionTrigger();

  const { startNodeCreation } = useStartNodeCreation();

  const { publishExperimentVersion } = usePublishExperimentVersion();
  const { activateWorkflowVersion } = useActivateWorkflowVersion();
  const [isPublishingExperiment, setIsPublishingExperiment] = useState(false);
  const [isPromotingWinner, setIsPromotingWinner] = useState(false);

  const onConnect = async (edgeConnect: WorkflowConnection) => {
    const steps = workflowWithCurrentVersion?.currentVersion?.steps;
    const sourceStep = isDefined(steps)
      ? steps.find((step) => step.id === edgeConnect.source)
      : undefined;

    if (sourceStep?.type === 'IF_ELSE') {
      const updatedStep = prepareIfElseStepWithNewBranch({
        parentStep: sourceStep,
        targetStepId: edgeConnect.target,
      });

      await updateStep(updatedStep);
    }

    setWorkflowDiagram((diagram) => {
      if (isDefined(diagram) === false) {
        throw new Error(
          'It must be impossible for the edges to be updated if the diagram is not defined yet. Be sure the diagram is rendered only when defined.',
        );
      }

      return {
        ...diagram,
        edges: addEdge<WorkflowDiagramEdge>(edgeConnect, diagram.edges),
      };
    });

    if (sourceStep?.type === 'IF_ELSE') {
      return;
    }

    createEdge({
      source: edgeConnect.source,
      target: edgeConnect.target,
      connectionOptions: getConnectionOptionsForSourceHandle({
        sourceHandleId: edgeConnect.sourceHandle,
      }),
    });
  };

  const handleReconnect = useCallback(
    async (oldEdge: Edge, connection: Connection) => {
      assertEdgeHasDefinedHandlesOrThrow(oldEdge);
      assertWorkflowConnectionOrThrow(connection);

      await deleteEdge({
        source: oldEdge.source,
        target: oldEdge.target,
        sourceConnectionOptions: getConnectionOptionsForSourceHandle({
          sourceHandleId: oldEdge.sourceHandle,
        }),
      });

      await createEdge({
        source: connection.source,
        target: connection.target,
        connectionOptions: getConnectionOptionsForSourceHandle({
          sourceHandleId: connection.sourceHandle,
        }),
      });
    },
    [deleteEdge, createEdge],
  );

  const onDeleteEdge = async (edge: WorkflowDiagramEdge) => {
    await deleteEdge({
      source: edge.source,
      target: edge.target,
    });
  };

  const onNodeDragStop: OnNodeDrag<WorkflowDiagramNode> = async (_, node) => {
    const stepToUpdate =
      workflowWithCurrentVersion?.currentVersion?.steps?.find(
        (step) => step.id === node.id,
      );

    if (isDefined(stepToUpdate)) {
      await updateStep({
        ...stepToUpdate,
        position: node.position,
      });

      return;
    }

    const triggerToUpdate = workflowWithCurrentVersion?.currentVersion?.trigger;

    if (isDefined(triggerToUpdate)) {
      await updateTrigger({
        ...triggerToUpdate,
        position: node.position,
      });

      return;
    }
  };

  if (!isDefined(workflowWithCurrentVersion)) {
    return null;
  }

  const currentVersionStatus =
    workflowWithCurrentVersion.currentVersion.status;
  const tagProps = getWorkflowVersionStatusTagProps({
    workflowVersionStatus: currentVersionStatus,
  });

  const hasActiveVersion = workflowWithCurrentVersion.versions.some(
    (version) => version.status === 'ACTIVE',
  );
  const hasExperimentVersion = workflowWithCurrentVersion.versions.some(
    (version) => version.status === 'EXPERIMENT',
  );
  const abSubtitle =
    hasActiveVersion && hasExperimentVersion
      ? 'Active (A) · Experiment (B) · 50/50'
      : null;

  const handlePublishAsExperiment = async () => {
    setIsPublishingExperiment(true);

    try {
      await publishExperimentVersion({
        workflowVersionId: workflowWithCurrentVersion.currentVersion.id,
      });
    } finally {
      setIsPublishingExperiment(false);
    }
  };

  const handlePromoteWinner = async () => {
    setIsPromotingWinner(true);

    try {
      await activateWorkflowVersion({
        workflowVersionId: workflowWithCurrentVersion.currentVersion.id,
        workflowId: workflowWithCurrentVersion.id,
      });
    } finally {
      setIsPromotingWinner(false);
    }
  };

  const handlePaneContextMenu = ({ x, y }: { x: number; y: number }) => {
    setWorkflowDiagramRightClickMenuPosition({
      x,
      y,
    });
  };

  const tagArea = (
    <>
      {isDefined(abSubtitle) && (
        <StyledAbSubtitle>{abSubtitle}</StyledAbSubtitle>
      )}
      {currentVersionStatus === 'DRAFT' && (
        <Button
          title={
            isPublishingExperiment
              ? 'Publishing…'
              : 'Publish as experiment'
          }
          variant="secondary"
          size="small"
          disabled={isPublishingExperiment}
          onClick={() => {
            void handlePublishAsExperiment();
          }}
        />
      )}
      {currentVersionStatus === 'EXPERIMENT' && (
        <Button
          title={isPromotingWinner ? 'Promoting…' : 'Promote winner'}
          variant="secondary"
          size="small"
          disabled={isPromotingWinner}
          onClick={() => {
            void handlePromoteWinner();
          }}
        />
      )}
    </>
  );

  return (
    <ReactFlowProvider>
      <WorkflowDiagramCanvasBase
        nodeTypes={{
          default: WorkflowDiagramStepNodeEditable,
          'empty-trigger': WorkflowDiagramEmptyTriggerEditable,
          empty: WorkflowDiagramStepNodeEditable,
        }}
        edgeTypes={{
          blank: WorkflowDiagramBlankEdge,
          editable: WorkflowDiagramDefaultEdgeEditable,
        }}
        tagContainerTestId="workflow-visualizer-status"
        tagColor={tagProps.color}
        tagText={tagProps.text}
        tagArea={tagArea}
        onConnect={onConnect}
        onReconnect={handleReconnect}
        onNodeDragStop={onNodeDragStop}
        handlePaneContextMenu={handlePaneContextMenu}
        nodesConnectable
        nodesDraggable
        onDeleteEdge={onDeleteEdge}
        startNodeCreation={startNodeCreation}
      />

      <WorkflowDiagramCanvasEditableEffect />
    </ReactFlowProvider>
  );
};
