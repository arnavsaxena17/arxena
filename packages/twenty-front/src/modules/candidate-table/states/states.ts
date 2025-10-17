import { enrichmentsState, sampleEnrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/candidate-search.types';
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

export interface FilterCondition {
  column: number;
  conditions: Array<{
    name: string;
    args: any[];
  }>;
  operation: string;
}

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
  searchPlanFilters?: {
    searchPlan: any;
    appliedFilters: Record<string, any>;
    isActive: boolean;
  } | null;
  activeFilters: FilterCondition[];
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
    searchFilter?: {
      edges?: Array<{
        node: {
          id: string;
          name: string;
          searchFilterParameter?: any;
          searchFilterName?: string;
          searchFilterFields?: any;
        }
      }>
    };
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
    activeFilters: [],
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
// Store the detailed candidate data fetched from GraphQL
export const candidateDataState = atom<any>({
  key: 'candidate-table/candidateDataState',
  default: null,
});

// Global trigger for refetching jobs - increments when jobs need to be refetched
export const jobsRefetchTriggerState = atom<number>({
  key: 'candidate-table/jobsRefetchTriggerState',
  default: 0,
});

// Chat messages state - stores chat history for AI assistant
export const chatMessagesState = atom<Array<{
  id: string;
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters';
  content: string;
  timestamp: Date;
  metadata?: {
    searchParameters?: any;
    enrichments?: any;
    filters?: any;
    actionButtons?: Array<{
      id: string;
      label: string;
      action: string;
      disabled?: boolean;
    }>;
  };
}>>({
  key: 'candidate-table/chatMessagesState',
  default: [],
});

// Search plans state - stores search plans for the current job
export const searchPlansState = atom<Array<{
  id: string;
  name: string;
  filters: {
    keywords: string[];
    jobTitle: string;
    location: string;
    industry: string;
    seniority: string;
    searchType: LinkedInSearchType;
    searchCategory: LinkedInSearchCategory;
  };
  enrichments: string[];
  columnFilters: number;
  createdAt: Date;
  updatedAt: Date;
}>>({
  key: 'candidate-table/searchPlansState',
  default: [],
});

// Resolved parameters state - stores resolved search parameters
export const resolvedParametersState = atom<any>({
  key: 'candidate-table/resolvedParametersState',
  default: null,
});

// Selector for chat messages - derives from searchFilter.chatHistory and merges with stored state
export const chatMessagesSelector = selector({
  key: 'candidate-table/chatMessagesSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const stored = get(chatMessagesState);

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return stored messages or empty array
    if (!job) {
      return stored.length > 0 ? stored : [];
    }

    // For now, return stored messages. In the future, this could fetch from searchFilter.chatHistory
    // via the job's searchFilterId using a GraphQL query
    return stored;
  },
  set: ({ set }, newValue) => {
    set(chatMessagesState, newValue as any);
  },
});

// Selector for search plans - derives from searchFilter data and merges with stored state
export const searchPlansSelector = selector({
  key: 'candidate-table/searchPlansSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const stored = get(searchPlansState);

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return stored plans or empty array
    if (!job) {
      return stored.length > 0 ? stored : [];
    }

    // For now, return stored plans. In the future, this could fetch from searchFilter.enrichmentConfigs
    // and other searchFilter fields via the job's searchFilterId using a GraphQL query
    return stored;
  },
  set: ({ set }, newValue) => {
    set(searchPlansState, newValue as any);
  },
});

// Selector for resolved parameters - derives from searchFilter.searchFilterParameter and merges with stored state
export const resolvedParametersSelector = selector({
  key: 'candidate-table/resolvedParametersSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const stored = get(resolvedParametersState);
    const parsedJD = get(parsedJDSelector);

    // PRIORITY 1: Check if parsedJD has updated resolved parameters (from user changes)
    if (parsedJD?.searchParameters) {
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          console.log("parsedJD.searchParameters", parsedJD.searchParameters);
          console.log('searchParam.resolvedSearchParameters Loading resolved parameters from parsedJD (user updates):', searchParam.resolvedSearchParameters);
          return searchParam.resolvedSearchParameters;
        }
      }
    }

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return stored parameters or null
    if (!job) {
      return stored;
    }

    // PRIORITY 2: Extract resolved parameters from job's searchFilter data (database)
    const searchFilterEdges = job?.searchFilter?.edges || [];
    
    if (searchFilterEdges.length > 0) {
      // Get the first search filter's parameters
      const searchFilterNode = searchFilterEdges[0]?.node;
      const searchFilterParameter = searchFilterNode?.searchFilterParameter;
      
      if (searchFilterParameter?.resolvedSearchParameters) {
        console.log('Loading resolved parameters from database:', searchFilterParameter.resolvedSearchParameters);
        return searchFilterParameter.resolvedSearchParameters;
      }
    }

    // PRIORITY 3: Fallback to stored parameters if no database data found
    return stored;
  },
  set: ({ set }, newValue) => {
    set(resolvedParametersState, newValue);
  },
});

// Search Strategy State Atoms
