import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { atom, selector } from "recoil";

export type Change = {
  row: number;
  prop: string;
  oldValue: any;
  newValue: any;
  rowId: string;
};

export interface TableState {
  rawData: any[];
  selectedRowIds: string[];
  isRightPanelOpen: boolean;
  currentRightPanelRowId: string | null;
  isLoading: boolean;
  error: string | null;

  unreadMessagesCounts: Record<string, number>;
  undoStack: Change[];
  redoStack: Change[];
}
export const jobIdAtom = atom<string>({
  key: 'candidate-table/jobIdAtom',
  default: 'job-id',
});

// Store the jobs data fetched from the API
export const jobsState = atom<
  Array<{
    id: string;
    name: string;
    pathPosition?: string;
    isActive: boolean;
    createdAt?: string;
    jobLocation?: string;
    candidates?: {
      edges?: Array<{
        node: {
          id: string;
        }
      }>
    }
  }>
>({
  key: 'candidate-table/jobsState',
  default: [],
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
    unreadMessagesCounts: {},
    undoStack: [],
    redoStack: [],

  },
});

export const filteredCandidatesCountState = atom<number>({
  key: 'filteredCandidatesCountState',
  default: 0,
});

export const selectedConversationStatusState = atom<string | null>({
  key: 'selectedConversationStatusState',
  default: null,
});

export const processedDataSelector = selector({
  key: 'processedDataSelector',
  get: ({ get }) => {
    const { rawData, selectedRowIds } = get(tableStateAtom);
    console.log("rawData::", rawData);

    console.log("raw candidate field values::", rawData[0]?.candidateFieldValues?.edges?.map((x: { node: { candidateFields: { name: any; }; }; }) => x?.node?.candidateFields?.name));
    return ProcessedData({ rawData, selectedRowIds });
  },
});

export const columnsSelector = selector({
  key: 'columnsSelector',
  get: ({ get }) => {
    const state = get(tableStateAtom);
    const processedData = get(processedDataSelector);
    
    return TableColumns({ 
      processedData,
      unreadMessagesCounts: state.unreadMessagesCounts
    });
  },
});

export const showRecordActionBarSelector = selector({
  key: 'showRecordActionBarSelector',
  get: ({get}) => {
    const tableState = get(tableStateAtom);
    return tableState.selectedRowIds.length > 0;
  }
});