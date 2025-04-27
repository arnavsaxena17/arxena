import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { atom, selector } from "recoil";
import { CandidateNode } from "twenty-shared";

export interface TableState {
  rawData: CandidateNode[];
  selectedRowIds: string[];
  isRightPanelOpen: boolean;
  currentRightPanelRowId: string | null;
  isLoading: boolean;
  error: string | null;
}
export const jobIdAtom = atom<string>({
  key: 'jobIdAtom',
  default: '',
});
export const tableStateAtom = atom<TableState>({
  key: 'tableStateAtom',
  default: {
    rawData: [],
    selectedRowIds: [],
    isRightPanelOpen: false,
    currentRightPanelRowId: null,
    isLoading: false,
    error: null,
  },
});
export const processedDataSelector = selector({
  key: 'processedDataSelector',
  get: ({ get }) => {
    const { rawData, selectedRowIds } = get(tableStateAtom);
    return ProcessedData({ rawData, selectedRowIds });
  },
});
export const columnsSelector = selector({
  key: 'columnsSelector',
  get: ({ get }) => {
    const processedData = get(processedDataSelector);
    return TableColumns({ processedData });
  },
});
export const showRecordActionBarSelector = selector({
  key: 'showRecordActionBarSelector',
  get: ({get}) => {
    const tableState = get(tableStateAtom);
    return tableState.selectedRowIds.length > 0;
  }
});