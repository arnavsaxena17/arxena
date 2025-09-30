import { enrichmentsState, sampleEnrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { atom, selector } from "recoil";
import { sortCandidates } from '../utils/customSortUtils';
import { customSortState } from './customSortState';

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
    searchName?: string;
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
    const customSort = get(customSortState);
    
    // Add safety check for rawData
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    // Only log when rawData actually changes (not on every render)
    if (rawData.length > 0) {
      console.log("rawData::", rawData);
      console.log("raw candidate field values::", rawData[0]?.candidateFieldValues?.edges?.map((x: { node: { candidateFields: { name: any; }; }; }) => x?.node?.candidateFields?.name));
    }
    
    const processedData = ProcessedData({ rawData, selectedRowIds });
    
    // Get enrichment fields for sorting
    const customEnrichments = get(enrichmentsState);
    const sampleEnrichments = get(sampleEnrichmentsState);
    const allEnrichments = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
      const exists = acc.find(item => item.modelName === current.modelName);
      if (!exists) {
        return [...acc, current];
      }
      return acc;
    }, []);
    
    // Get all possible field names from processed data
    const availableFieldNames = new Set<string>();
    if (processedData.length > 0) {
      processedData.forEach(candidate => {
        Object.keys(candidate).forEach(key => availableFieldNames.add(key));
      });
    }
    
    // Get enrichment fields that actually exist in the candidate data
    const enrichmentFields = allEnrichments.flatMap(enrichment => 
      enrichment.fields?.map((field: any) => field.name).filter((fieldName: string) => 
        availableFieldNames.has(fieldName)
      ) || []
    );
    
    // Only log when there are actual enrichment fields
    if (enrichmentFields.length > 0) {
      console.log("Available field names for sorting:", Array.from(availableFieldNames));
      console.log("Validated enrichment fields for sorting:", enrichmentFields);
    }
    
    // Apply custom sorting
    return sortCandidates(processedData, customSort, enrichmentFields);
  },
});

export const columnsSelector = selector({
  key: 'columnsSelector',
  get: ({ get }) => {
    const state = get(tableStateAtom);
    const processedData = get(processedDataSelector);
    const customEnrichments = get(enrichmentsState);
    const sampleEnrichments = get(sampleEnrichmentsState);
    
    // Merge enrichments (same logic as in DataTable)
    const allEnrichments = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
      const exists = acc.find(item => item.modelName === current.modelName);
      if (!exists) {
        return [...acc, current];
      }
      return acc;
    }, []);
    
    // Only log when enrichments actually change
    if (allEnrichments.length > 0) {
      console.log("customEnrichments in columnsSelector:", customEnrichments);
      console.log("sampleEnrichments in columnsSelector:", sampleEnrichments);
      console.log("merged allEnrichments in columnsSelector:", allEnrichments);
    }
    
    return TableColumns({ 
      processedData,
      unreadMessagesCounts: state.unreadMessagesCounts,
      enrichments: allEnrichments
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

// Store the detailed candidate data fetched from GraphQL
export const candidateDataState = atom<any>({
  key: 'candidate-table/candidateDataState',
  default: null,
});