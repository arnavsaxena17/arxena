import { atom } from 'recoil';

export type WorkflowDiagramRightClickMenuPosition = {
  x: number;
  y: number;
};

export const workflowDiagramRightClickMenuPositionState = atom<
  WorkflowDiagramRightClickMenuPosition | undefined
>({
  key: 'workflowDiagramRightClickMenuPositionState',
  default: undefined,
});
