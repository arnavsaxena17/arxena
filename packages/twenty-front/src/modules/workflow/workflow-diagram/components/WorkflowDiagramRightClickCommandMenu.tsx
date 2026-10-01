import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useWorkflowVersion } from '@/workflow/hooks/useWorkflowVersion';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { useCloseRightClickMenu } from '@/workflow/workflow-diagram/hooks/useCloseRightClickMenu';
import { useStartNodeCreation } from '@/workflow/workflow-diagram/hooks/useStartNodeCreation';
import { useWorkflowDiagramScreenToFlowPosition } from '@/workflow/workflow-diagram/hooks/useWorkflowDiagramScreenToFlowPosition';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import { getWorkflowDiagramPdfFileName } from '@/workflow/workflow-diagram/utils/workflowDiagramPdfExport';
import { useTidyUp } from '@/workflow/workflow-version/hooks/useTidyUp';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useRef } from 'react';
import { isDefined } from 'twenty-shared/utils';
import {
  IconDownload,
  IconFocusCentered,
  IconPlus,
  IconReorder,
} from 'twenty-ui/icon';
import { MenuItem } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { WorkflowDiagramRightClickCommandMenuClickOutsideEffect } from './WorkflowDiagramRightClickCommandMenuClickOutsideEffect';

const StyledContainer = styled.div<{ x: number; y: number }>`
  background: ${themeCssVariables.background.primary};
  border-radius: ${themeCssVariables.spacing[2]};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
  left: ${({ x }) => `${x}px`};
  padding: ${themeCssVariables.spacing[1]};
  position: absolute;
  top: ${({ y }) => `${y}px`};
  width: 200px;
  z-index: 10;
`;

export const WorkflowDiagramRightClickCommandMenu = ({
  showAddNode = true,
  onCenter,
  onDownloadPdf,
}: {
  showAddNode?: boolean;
  onCenter: () => void;
  onDownloadPdf: (fileName: string) => Promise<'downloaded' | 'empty'>;
}) => {
  const { t } = useLingui();
  const { enqueueErrorSnackBar } = useSnackBar();
  const rightClickCommandMenuRef = useRef<HTMLDivElement>(null);

  const { workflowDiagramScreenToFlowPosition } =
    useWorkflowDiagramScreenToFlowPosition();

  const { startNodeCreation } = useStartNodeCreation();

  const { closeRightClickMenu } = useCloseRightClickMenu();

  const workflowDiagramRightClickMenuPosition = useAtomComponentStateValue(
    workflowDiagramRightClickMenuPositionState,
  );

  const workflowVisualizerWorkflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );
  const workflowVersion = useWorkflowVersion(
    workflowVisualizerWorkflowVersionId,
  );

  const { tidyUp, tidyUpLocally } = useTidyUp();

  const handleReorderWorkflowDiagram = async () => {
    if (showAddNode) {
      await tidyUp();
    } else {
      tidyUpLocally();
    }
    closeRightClickMenu();
  };

  const handleCenterWorkflowDiagram = () => {
    onCenter();
    closeRightClickMenu();
  };

  const handleDownloadWorkflowDiagramPdf = async () => {
    closeRightClickMenu();

    try {
      const downloadResult = await onDownloadPdf(
        getWorkflowDiagramPdfFileName(workflowVersion?.workflow?.name),
      );

      if (downloadResult === 'empty') {
        enqueueErrorSnackBar({
          message: t`This workflow has nothing to export`,
        });
      }
    } catch {
      enqueueErrorSnackBar({
        message: t`Failed to download the workflow PDF`,
      });
    }
  };

  const addNode = () => {
    const position = workflowDiagramScreenToFlowPosition(
      workflowDiagramRightClickMenuPosition,
    );
    startNodeCreation({
      parentStepId: undefined,
      nextStepId: undefined,
      position,
    });
  };

  if (!isDefined(workflowDiagramRightClickMenuPosition)) {
    return;
  }

  return (
    <>
      <StyledContainer
        ref={rightClickCommandMenuRef}
        x={workflowDiagramRightClickMenuPosition.x}
        y={workflowDiagramRightClickMenuPosition.y}
      >
        {showAddNode && (
          <MenuItem text={t`Add node`} LeftIcon={IconPlus} onClick={addNode} />
        )}
        <MenuItem
          text={t`Tidy up workflow`}
          LeftIcon={IconReorder}
          onClick={handleReorderWorkflowDiagram}
        />
        <MenuItem
          text={t`Center`}
          LeftIcon={IconFocusCentered}
          onClick={handleCenterWorkflowDiagram}
        />
        <MenuItem
          text={t`Download PDF`}
          LeftIcon={IconDownload}
          onClick={() => {
            void handleDownloadWorkflowDiagramPdf();
          }}
        />
      </StyledContainer>
      <WorkflowDiagramRightClickCommandMenuClickOutsideEffect
        rightClickCommandMenuRef={rightClickCommandMenuRef}
      />
    </>
  );
};
