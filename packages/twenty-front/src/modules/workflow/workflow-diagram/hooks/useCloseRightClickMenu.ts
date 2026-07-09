import { workflowDiagramRightClickMenuPositionState } from '@/workflow/workflow-diagram/states/workflowDiagramRightClickMenuPositionState';
import { useSetRecoilState } from 'recoil';

export const useCloseRightClickMenu = () => {
  const setWorkflowDiagramRightClickMenuPosition = useSetRecoilState(
    workflowDiagramRightClickMenuPositionState,
  );

  const closeRightClickMenu = () => {
    setWorkflowDiagramRightClickMenuPosition(undefined);
  };

  return { closeRightClickMenu };
};
