import { useListenClickOutside } from '@/ui/utilities/pointer-event/hooks/useListenClickOutside';
import { WORKFLOW_DIAGRAM_RIGHT_CLICK_MENU_CLICK_OUTSIDE_ID } from '@/workflow/workflow-diagram/constants/WorkflowDiagramRightClickMenuClickOutsideId';
import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import { useSetRecoilState } from 'recoil';

export const WorkflowDiagramRightClickCommandMenuClickOutsideEffect = ({
  rightClickCommandMenuRef,
}: {
  rightClickCommandMenuRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const setWorkflowDiagramRightClickMenuPosition = useSetRecoilState(
    workflowDiagramRightClickMenuPositionState,
  );

  useListenClickOutside({
    refs: [rightClickCommandMenuRef],
    callback: (event) => {
      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();

      setWorkflowDiagramRightClickMenuPosition(undefined);
    },
    listenerId: WORKFLOW_DIAGRAM_RIGHT_CLICK_MENU_CLICK_OUTSIDE_ID,
  });

  return null;
};
