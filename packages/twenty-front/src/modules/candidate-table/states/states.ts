import { Enrichment, enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { activeAssistantThreadIdState } from '@/candidate-search/states/searchConfigState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { atom, selector } from "recoil";
import { CandidateNode, LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared';
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

export interface SortConfig {
  column: number;
  sortOrder: 'asc' | 'desc';
}

// New configuration-based filter system
export interface FilterConfig {
  // Status filter
  conversationStatus?: string | null;
  
  // Search filter
  searchQuery?: string;
  
  // Handsontable column filters
  columnFilters: FilterCondition[];
  
  // Search plan filters (future)
  searchPlanFilters?: {
    searchPlan: any;
    appliedFilters: Record<string, any>;
    isActive: boolean;
  } | null;
}

export interface TableConfiguration {
  filters: FilterConfig;
  sorting: SortConfig[];
  // Future: pagination, column visibility, etc.
}

export interface TableState {
  rawData: CandidateNode[];
  selectedRowIds: string[];
  isRightPanelOpen: boolean;
  currentRightPanelRowId: string | null;
  isLoading: boolean;
  error: string | null;

  undoStack: Change[];
  redoStack: Change[];
  
  // New configuration-based approach
  configuration: TableConfiguration;
  
  // Legacy fields (to be removed after migration)
  activeFilters: FilterCondition[];
  sortConfig: SortConfig[];
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
    assistantThread?: {
      edges?: Array<{
        node: {
          id: string;
          name: string;
          messages?: any[];
          assistantParameters?: any;
          enrichmentConfigs?: any[];
          columnFilters?: any[];
          assistantSearchStrategy?: any;
          isActive?: boolean;
          jobId?: string;
          recruiterId?: string;
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
    undoStack: [],
    redoStack: [],
    configuration: {
      filters: {
        conversationStatus: null,
        searchQuery: '',
        columnFilters: [],
        searchPlanFilters: null,
      },
      sorting: [],
    },
    // Legacy fields (to be removed after migration)
    activeFilters: [],
    sortConfig: [],
  },
});

export const selectedCandidateIdState = atom<string | null>({
  key: 'candidate-table/selectedCandidateIdState',
  default: null,
});

export const unreadMessagesCountsState = atom<Record<string, number>>({
  key: 'candidate-table/unreadMessagesCountsState',
  default: {},
});

export const filteredCandidatesCountState = atom<number>({
  key: 'filteredCandidatesCountState',
  default: 0,
});

export const selectedConversationStatusState = atom<string | null>({
  key: 'selectedConversationStatusState',
  default: null,
});

// Raw data without any filtering or sorting - now in table-ready format
// Raw processed data without any filtering or sorting
export const processedDataSelector = selector({
  key: 'processedDataSelector',
  get: ({ get }) => {
    const { rawData, selectedRowIds } = get(tableStateAtom);
    
    // Add safety check for rawData
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }
    
    // Return only processed data without filtering/sorting
    // Removed console.logs to prevent unnecessary re-renders and console noise
    return ProcessedData({ rawData, selectedRowIds });
  },
});
// Configuration-based filtered and sorted data
// Configuration-based filtered and sorted data
export const configuredDataSelector = selector({
  key: 'configuredDataSelector',
  get: ({ get }) => {
    const processedData = get(processedDataSelector);
    const { configuration } = get(tableStateAtom);
    const customSort = get(customSortState);
    
    if (!processedData.length) return processedData;
    
    let filteredData = [...processedData];
    
    // Apply status filter
    if (configuration.filters.conversationStatus) {
      filteredData = filteredData.filter((candidate: any) => 
        candidate.candConversationStatus === configuration.filters.conversationStatus
      );
    }
    
    // Apply search filter
    if (configuration.filters.searchQuery) {
      const query = configuration.filters.searchQuery.toLowerCase();
      filteredData = filteredData.filter((candidate: any) => {
        return Object.values(candidate).some(value => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }
    
    // Apply search plan filters (if active)
    if (configuration.filters.searchPlanFilters?.isActive) {
      // Future implementation for search plan filters
      // filteredData = applySearchPlanFilters(filteredData, configuration.filters.searchPlanFilters);
    }
    
    // Apply custom sorting only if no multi-column sorting is configured
    if (configuration.sorting.length === 0) {
      const customEnrichments = get(enrichmentsState);
      const sampleEnrichments = get(sampleEnrichmentsState);
      const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
        const exists = acc.find(item => item.modelName === current.modelName);
        if (!exists) {
          return [...acc, current];
        }
        return acc;
      }, []);
      
      const aiFilterFields = allAiFilters.flatMap(aiFilter =>
        aiFilter.fields?.map((field: any) => field.name) || []
      );
      
      filteredData = sortCandidates(filteredData, customSort, aiFilterFields);
    }
    
    return filteredData;
  },
});


export const columnsSelector = selector({
  key: 'columnsSelector',
  get: ({ get }) => {
    const unreadMessagesCounts = get(unreadMessagesCountsState);
    const processedData = get(processedDataSelector);
    const searchResults = get(searchResultsState);
    const customEnrichments = get(enrichmentsState);
    const sampleEnrichments = get(sampleEnrichmentsState);
    
    // Deduplicate when merging: processedData (saved candidates) takes priority
    // Create a set of all unique identifiers from processedData using tempId || id (same key as addSearchResults)
    const processedDataIds = new Set<string>();
    processedData.forEach((candidate: any) => {
      const candidateId = candidate.tempId || candidate.id;
      if (candidateId) {
        processedDataIds.add(candidateId);
      }
    });
    
    // Filter searchResults to exclude any that are already in processedData
    const uniqueSearchResults = searchResults.filter((candidate: any) => {
      const candidateId = candidate.tempId || candidate.id;
      return !candidateId || !processedDataIds.has(candidateId);
    });
    
    // Merge with processedData first (saved candidates), then unique searchResults
    const mergedData = [...processedData, ...uniqueSearchResults];
    
    // Merge AI filters (same logic as in DataTable)
    const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<Enrichment[]>((acc, current) => {
      const exists = acc.find(item => item.modelName === current.modelName);
      if (!exists) {
        return [...acc, current];
      }
      return acc;
    }, []);
    
    // Only log when AI filters actually change
    if (allAiFilters.length > 0) {
      console.log("customEnrichments in columnsSelector:", customEnrichments);
      console.log("sampleEnrichments in columnsSelector:", sampleEnrichments);
      console.log("merged allAiFilters in columnsSelector:", allAiFilters);
    }
    
    return TableColumns({
      processedData: mergedData,
      unreadMessagesCounts,
      enrichments: allAiFilters
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
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
  metadata?: {
    searchParameters?: any;
    enrichments?: any;
    filters?: any;
    sorts?: any;
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

// Selector for chat messages - derives from assistantThread.messages and merges with stored state
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

    // For now, return stored messages. In the future, this could fetch from assistantThread.messages
    // via the job's assistantThreadId using a GraphQL query
    return stored;
  },
  set: ({ set }, newValue) => {
    set(chatMessagesState, newValue as any);
  },
});

// Selector for search plans - derives from assistantThread data and merges with stored state
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

    // For now, return stored plans. In the future, this could fetch from assistantThread.enrichmentConfigs
    // and other assistantThread fields via the job's assistantThreadId using a GraphQL query
    return stored;
  },
  set: ({ set }, newValue) => {
    set(searchPlansState, newValue as any);
  },
});

// Selector for resolved parameters - derives from assistantThread.assistantParameters and merges with stored state
// Configuration management helpers
export const updateFilterConfig = (setTableState: any) => (filterUpdates: Partial<FilterConfig>) => {
  setTableState((prev: TableState) => ({
    ...prev,
    configuration: {
      ...prev.configuration,
      filters: {
        ...prev.configuration.filters,
        ...filterUpdates,
      },
    },
  }));
};

export const updateSortConfig = (setTableState: any) => (sortConfig: SortConfig[]) => {
  setTableState((prev: TableState) => ({
    ...prev,
    configuration: {
      ...prev.configuration,
      sorting: sortConfig,
    },
  }));
};

export const clearAllFilters = (setTableState: any) => () => {
  setTableState((prev: TableState) => ({
    ...prev,
    configuration: {
      ...prev.configuration,
      filters: {
        conversationStatus: null,
        searchQuery: '',
        columnFilters: [],
        searchPlanFilters: null,
      },
    },
  }));
};

export const clearAllSorting = (setTableState: any) => () => {
  setTableState((prev: TableState) => ({
    ...prev,
    configuration: {
      ...prev.configuration,
      sorting: [],
    },
  }));
};

export const resolvedParametersSelector = selector({
  key: 'candidate-table/resolvedParametersSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const stored = get(resolvedParametersState);
    const parsedJD = get(parsedJDSelector);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(t => t.id === activeId);
      if (activeThread?.assistantParameters?.resolvedSearchParameters) {
        return activeThread.assistantParameters.resolvedSearchParameters as Record<string, unknown>;
      }
    }
    const job = jobs.find(j => j.id === jobId);

    // If no job found, return stored parameters or null
    if (!job) {
      return stored;
    }

    // PRIORITY 2: Extract resolved parameters from job's assistantThread data (database)
    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      const assistantParameters = threadNode?.assistantParameters;
      if (assistantParameters?.resolvedSearchParameters) {
        return assistantParameters.resolvedSearchParameters;
      }
    }

    // PRIORITY 3: Fallback to stored parameters if no database data found
    return stored;
  },
  set: ({ set }, newValue) => {
    set(resolvedParametersState, newValue);
  },
});

export const enrichmentsSelector = selector({
  key: 'candidate-table/enrichmentsSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const parsedJD = get(parsedJDSelector);
    const activeId = get(activeAssistantThreadIdState)

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(t => t.id === activeId);
      if (activeThread?.enrichmentConfigs && activeThread.enrichmentConfigs.length > 0) {
        return activeThread.enrichmentConfigs;
      }
    }
    const job = jobs.find(j => j.id === jobId);
    if (!job) return [];

    // PRIORITY 2: Extract enrichments from job's assistantThread data (database)
    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      if (threadNode?.enrichmentConfigs && threadNode.enrichmentConfigs.length > 0) {
        return threadNode.enrichmentConfigs;
      }
    }

    // PRIORITY 3: Fallback to empty array if no database data found
    return [];
  },
});

export const filtersSelector = selector({
  key: 'candidate-table/filtersSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const parsedJD = get(parsedJDSelector);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(t => t.id === activeId);
      if (activeThread?.columnFilters && Array.isArray(activeThread.columnFilters) && activeThread.columnFilters.length > 0) {
        return activeThread.columnFilters;
      }
    }
    const job = jobs.find(j => j.id === jobId);
    if (!job) return [];

    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      if (threadNode?.columnFilters && threadNode.columnFilters.length > 0) {
        return threadNode.columnFilters;
      }
    }
    return [];
  },
});

export const sortsSelector = selector({
  key: 'candidate-table/sortsSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const parsedJD = get(parsedJDSelector);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(t => t.id === activeId);
      if (activeThread?.sortColumns && Array.isArray(activeThread.sortColumns) && activeThread.sortColumns.length > 0) {
        return activeThread.sortColumns;
      }
    }
    const job = jobs.find(j => j.id === jobId);

    // If no job found, return null
    if (!job) {
      return null;
    }

    // PRIORITY 2: Extract sorts from job's assistantThread data (database)
    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      if (threadNode?.columnSortConfigs) {
        return threadNode.columnSortConfigs;
      }
      if (threadNode?.assistantSearchStrategy) {
        return threadNode.assistantSearchStrategy;
      }
    }

    // PRIORITY 3: Fallback to null if no database data found
    return null;
  },
});

// Search Strategy State Atoms

// Candidate persistence state tracking
export type CandidatePersistenceState = 'fetched' |  'saved';

export const candidatePersistenceStateAtom = atom<Record<string, CandidatePersistenceState>>({
  key: 'candidate-table/candidatePersistenceStateAtom',
  default: {},
});

// Helper selector to infer candidate state
export const candidateStateSelector = selector({
  key: 'candidate-table/candidateStateSelector',
  get: ({ get }) => {
    const persistenceStates = get(candidatePersistenceStateAtom);

    return (candidate: any): CandidatePersistenceState => {
      const candidateName = candidate.name || candidate.fullName;
      
      if (persistenceStates[candidate.id || candidate.linkedinId]) {
        const explicitState = persistenceStates[candidate.id || candidate.linkedinId];
        return explicitState;
      }
      
      // Infer state from candidate properties - simplified logic
      if (candidate.personId) {
        return 'saved'; // Has database ID = saved
      }
      
      return 'fetched'; // No database ID = fetched from LinkedIn
    };
  },
});

// Helper to get row border color based on state
export const getRowBorderColor = (candidate: any, getCandidateState: (candidate: any) => CandidatePersistenceState): string => {
  const state = getCandidateState(candidate);
  
  switch (state) {
    case 'fetched':
      return '#3b82f6'; // Blue
    case 'saved':
      return '#10b981'; // Green
    default:
      return '#10b981'; // Default to green
  }
};
