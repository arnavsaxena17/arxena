import { atom } from 'recoil';

export type Change = {
  row: number;
  prop: string;
  oldValue: any;
  newValue: any;
  rowId: string;
};

export type TableState = {
  rawData: any[];
  selectedRowIds: string[];
  isLoading: boolean;
  error: string | null;
  unreadMessagesCounts: Record<string, number>;
  undoStack: Change[];
  redoStack: Change[];
};

export const tableStateAtom = atom<TableState>({
  key: 'tableStateAtom',
  default: {
    rawData: [],
    selectedRowIds: [],
    isLoading: false,
    error: null,
    unreadMessagesCounts: {},
    undoStack: [],
    redoStack: [],
  },
}); 