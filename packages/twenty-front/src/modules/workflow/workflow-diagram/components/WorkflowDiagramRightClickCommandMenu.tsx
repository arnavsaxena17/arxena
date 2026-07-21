import { MenuItem } from 'twenty-ui';
import { IconPlus } from 'twenty-ui/icons';
import { useCloseRightClickMenu } from '@/workflow/workflow-diagram/hooks/useCloseRightClickMenu';
import { useStartNodeCreation } from '@/workflow/workflow-diagram/hooks/useStartNodeCreation';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import { TRIGGER_STEP_ID } from '@/workflow/workflow-trigger/constants/TriggerStepId';
import styled from '@emotion/styled';
import { useLingui } from '@lingui/react/macro';
import { useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

import { WorkflowDiagramRightClickCommandMenuClickOutsideEffect } from './WorkflowDiagramRightClickCommandMenuClickOutsideEffect';

const StyledContainer = styled.div<{ x: number; y: number }>`
  background: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  left: ${({ x }) => `${x}px`};
  padding: ${({ theme }) => theme.spacing(1)};
  position: absolute;
  top: ${({ y }) => `${y}px`};
  width: 200px;
  z-index: ${({ theme }) => theme.lastLayerZIndex};
`;

export const WorkflowDiagramRightClickCommandMenu = () => {
  const { t } = useLingui();
  const rightClickCommandMenuRef = useRef<HTMLDivElement>(null);

  const workflowDiagramRightClickMenuPosition = useRecoilValue(
    workflowDiagramRightClickMenuPositionState,
  );

  const { startNodeCreation } = useStartNodeCreation();
  const { closeRightClickMenu } = useCloseRightClickMenu();

  const addNode = () => {
    startNodeCreation(TRIGGER_STEP_ID);
    closeRightClickMenu();
  };

  if (!isDefined(workflowDiagramRightClickMenuPosition)) {
    return null;
  }

  return (
    <>
      <WorkflowDiagramRightClickCommandMenuClickOutsideEffect
        rightClickCommandMenuRef={rightClickCommandMenuRef}
      />
      <StyledContainer
        ref={rightClickCommandMenuRef}
        x={workflowDiagramRightClickMenuPosition.x}
        y={workflowDiagramRightClickMenuPosition.y}
      >
        <MenuItem LeftIcon={IconPlus} onClick={addNode} text={t`Add node`} />
      </StyledContainer>
    </>
  );
};
