import { Enrichment, enrichmentsState, sampleEnrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { activeSearchFilterIdState } from '@/candidate-search/states/searchConfigState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/candidate-search.types';
import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { atom, selector } from "recoil";
import { CandidateNode } from 'twenty-shared';
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
    searchFilter?: {
      edges?: Array<{
        node: {
          id: string;
          name: string;
          searchFilterParameter?: any;
          searchFilterName?: string;
          searchFilterFields?: any;
          enrichmentConfigs?: any[];
          columnFilters?: any[];
          columnSortConfigs?: any;
          chatHistory?: any[];
          searchStrategy?: any;
          isActive?: boolean;
          jobId?: string;
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
      const allEnrichments = [...customEnrichments, ...sampleEnrichments].reduce<any[]>((acc, current) => {
        const exists = acc.find(item => item.modelName === current.modelName);
        if (!exists) {
          return [...acc, current];
        }
        return acc;
      }, []);
      
      const enrichmentFields = allEnrichments.flatMap(enrichment => 
        enrichment.fields?.map((field: any) => field.name) || []
      );
      
      filteredData = sortCandidates(filteredData, customSort, enrichmentFields);
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
    
    // Merge enrichments (same logic as in DataTable)
    const allEnrichments = [...customEnrichments, ...sampleEnrichments].reduce<Enrichment[]>((acc, current) => {
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
      processedData: mergedData,
      unreadMessagesCounts,
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
    const activeSearchFilterId = get(activeSearchFilterIdState);

    // PRIORITY 1: Check if parsedJD has updated resolved parameters for the ACTIVE searchFilter
    if (parsedJD?.searchFilters && activeSearchFilterId) {
      const activeSearchFilter = parsedJD.searchFilters.find(sf => sf.id === activeSearchFilterId);
      if (activeSearchFilter?.searchFilterParameter?.resolvedSearchParameters) {
        console.log("Loading resolved parameters for ACTIVE searchFilter:", activeSearchFilterId);
        console.log('searchFilter.searchFilterParameter.resolvedSearchParameters:', activeSearchFilter.searchFilterParameter.resolvedSearchParameters);
        return activeSearchFilter.searchFilterParameter.resolvedSearchParameters;
      }
    }
    
    // Fallback: Check any searchFilter that has resolvedSearchParameters (legacy behavior)
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        if (searchFilter.searchFilterParameter?.resolvedSearchParameters) {
          console.log("parsedJD.searchFilters (fallback)", parsedJD.searchFilters);
          console.log('searchFilter.searchFilterParameter.resolvedSearchParameters Loading resolved parameters from parsedJD (user updates):', searchFilter.searchFilterParameter.resolvedSearchParameters);
          return searchFilter.searchFilterParameter.resolvedSearchParameters;
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

export const enrichmentsSelector = selector({
  key: 'candidate-table/enrichmentsSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const parsedJD = get(parsedJDSelector);
    const activeSearchFilterId = get(activeSearchFilterIdState);

    // PRIORITY 1: Check if parsedJD has updated enrichments for the ACTIVE searchFilter
    if (parsedJD?.searchFilters && activeSearchFilterId) {
      const activeSearchFilter = parsedJD.searchFilters.find(sf => sf.id === activeSearchFilterId);
      if (activeSearchFilter?.enrichmentConfigs && activeSearchFilter.enrichmentConfigs.length > 0) {
        console.log('Loading enrichments for ACTIVE searchFilter:', activeSearchFilterId);
        console.log('enrichmentConfigs:', activeSearchFilter.enrichmentConfigs);
        return activeSearchFilter.enrichmentConfigs;
      }
    }
    
    // Fallback: Check any searchFilter that has enrichments (legacy behavior)
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        if (searchFilter.enrichmentConfigs && searchFilter.enrichmentConfigs.length > 0) {
          console.log('Loading enrichments from parsedJD (fallback):', searchFilter.enrichmentConfigs);
          return searchFilter.enrichmentConfigs;
        }
      }
    }

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return empty array
    if (!job) {
      return [];
    }

    // PRIORITY 2: Extract enrichments from job's searchFilter data (database)
    const searchFilterEdges = job?.searchFilter?.edges || [];
    
    if (searchFilterEdges.length > 0) {
      // Get the first search filter's enrichments
      const searchFilterNode = searchFilterEdges[0]?.node;
      
      if (searchFilterNode?.enrichmentConfigs && searchFilterNode.enrichmentConfigs.length > 0) {
        console.log('Loading enrichments from database:', searchFilterNode.enrichmentConfigs);
        return searchFilterNode.enrichmentConfigs;
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
    const activeSearchFilterId = get(activeSearchFilterIdState);

    // PRIORITY 1: Check if parsedJD has updated filters for the ACTIVE searchFilter
    if (parsedJD?.searchFilters && activeSearchFilterId) {
      const activeSearchFilter = parsedJD.searchFilters.find(sf => sf.id === activeSearchFilterId);
      if (activeSearchFilter?.columnFilters && activeSearchFilter.columnFilters.length > 0) {
        console.log('Loading filters for ACTIVE searchFilter:', activeSearchFilterId);
        console.log('columnFilters:', activeSearchFilter.columnFilters);
        return activeSearchFilter.columnFilters;
      }
    }
    
    // Fallback: Check any searchFilter that has filters (legacy behavior)
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        if (searchFilter.columnFilters && searchFilter.columnFilters.length > 0) {
          console.log('Loading filters from parsedJD (fallback):', searchFilter.columnFilters);
          return searchFilter.columnFilters;
        }
      }
    }

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return empty array
    if (!job) {
      return [];
    }

    // PRIORITY 2: Extract filters from job's searchFilter data (database)
    const searchFilterEdges = job?.searchFilter?.edges || [];
    
    if (searchFilterEdges.length > 0) {
      // Get the first search filter's filters
      const searchFilterNode = searchFilterEdges[0]?.node;
      
      if (searchFilterNode?.columnFilters && searchFilterNode.columnFilters.length > 0) {
        console.log('Loading filters from database:', searchFilterNode.columnFilters);
        return searchFilterNode.columnFilters;
      }
    }

    // PRIORITY 3: Fallback to empty array if no database data found
    return [];
  },
});

export const sortsSelector = selector({
  key: 'candidate-table/sortsSelector',
  get: ({ get }) => {
    const jobId = get(jobIdAtom);
    const jobs = get(jobsState);
    const parsedJD = get(parsedJDSelector);
    const activeSearchFilterId = get(activeSearchFilterIdState);

    // PRIORITY 1: Check if parsedJD has updated sorts for the ACTIVE searchFilter
    if (parsedJD?.searchFilters && activeSearchFilterId) {
      const activeSearchFilter = parsedJD.searchFilters.find(sf => sf.id === activeSearchFilterId);
      if (activeSearchFilter) {
        // Check flattened structure first
        if (activeSearchFilter.sortColumns && activeSearchFilter.sortColumns.length > 0) {
          console.log('Loading sorts for ACTIVE searchFilter (flattened):', activeSearchFilterId);
          console.log('sortColumns:', activeSearchFilter.sortColumns);
          return {
            name: activeSearchFilter.sortStrategyName || 'Generated Strategy',
            description: activeSearchFilter.sortStrategyDescription || 'Generated sorting strategy',
            reasoning: activeSearchFilter.sortStrategyReasoning || 'Generated reasoning',
            sortColumns: activeSearchFilter.sortColumns
          };
        }
      }
    }
    
    // Fallback: Check any searchFilter that has sorts (legacy behavior)
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        // Check flattened structure first
        if (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) {
          console.log('Loading sorts from parsedJD (fallback - flattened structure):', {
            sortColumns: searchFilter.sortColumns,
            strategyName: searchFilter.sortStrategyName
          });
          return {
            name: searchFilter.sortStrategyName || 'Generated Strategy',
            description: searchFilter.sortStrategyDescription || 'Generated sorting strategy',
            reasoning: searchFilter.sortStrategyReasoning || 'Generated reasoning',
            sortColumns: searchFilter.sortColumns
          };
        }
      }
    }

    const job = jobs.find(j => j.id === jobId);

    // If no job found, return null
    if (!job) {
      return null;
    }

    // PRIORITY 2: Extract sorts from job's searchFilter data (database)
    const searchFilterEdges = job?.searchFilter?.edges || [];
    
    if (searchFilterEdges.length > 0) {
      // Get the first search filter's sorts
      const searchFilterNode = searchFilterEdges[0]?.node;
      
      if (searchFilterNode?.columnSortConfigs) {
        console.log('Loading sorts from database:', searchFilterNode.columnSortConfigs);
        return searchFilterNode.columnSortConfigs;
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
