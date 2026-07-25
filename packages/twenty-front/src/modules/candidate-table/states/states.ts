import { Enrichment, enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { activeAssistantThreadIdState } from '@/candidate-search/states/searchConfigState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { ProcessedData } from '@/candidate-table/ProcessedData';
import { TableColumns } from '@/candidate-table/TableColumns';
import { createAtomSelector } from '@/ui/utilities/state/jotai/utils/createAtomSelector';
import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import { createAtomWritableSelector } from '@/ui/utilities/state/jotai/utils/createAtomWritableSelector';
import type { CandidateNode } from 'twenty-shared/arx';
import type { LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared/types';
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

export type ProjectStateItem = {
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
        projectId?: string;
        recruiterId?: string;
      };
    }>;
  };
  candidates?: {
    edges?: Array<{
      node: {
        id: string;
      };
    }>;
  };
};

export const projectIdAtom = createAtomState<string>({
  key: 'candidate-table/projectIdAtom',
  defaultValue: 'project-id',
});

export const jobIdAtom = projectIdAtom;

export const projectsState = createAtomState<ProjectStateItem[]>({
  key: 'candidate-table/projectsState',
  defaultValue: [],
});

export const tableStateAtom = createAtomState<TableState>({
  key: 'tableStateAtom',
  defaultValue: {
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
    activeFilters: [],
    sortConfig: [],
  },
});

export const selectedCandidateIdState = createAtomState<string | null>({
  key: 'candidate-table/selectedCandidateIdState',
  defaultValue: null,
});

export const unreadMessagesCountsState = createAtomState<Record<string, number>>({
  key: 'candidate-table/unreadMessagesCountsState',
  defaultValue: {},
});

export const filteredCandidatesCountState = createAtomState<number>({
  key: 'filteredCandidatesCountState',
  defaultValue: 0,
});

export const selectedConversationStatusState = createAtomState<string | null>({
  key: 'selectedConversationStatusState',
  defaultValue: null,
});

export const processedDataSelector = createAtomSelector({
  key: 'processedDataSelector',
  get: ({ get }) => {
    const { rawData, selectedRowIds } = get(tableStateAtom);

    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }

    return ProcessedData({ rawData, selectedRowIds });
  },
});

export const configuredDataSelector = createAtomSelector({
  key: 'configuredDataSelector',
  get: ({ get }) => {
    const processedData = get(processedDataSelector);
    const { configuration } = get(tableStateAtom);
    const customSort = get(customSortState);

    if (!processedData.length) return processedData;

    let filteredData = [...processedData];

    if (configuration.filters.conversationStatus) {
      filteredData = filteredData.filter(
        (candidate: any) =>
          candidate.candConversationStatus ===
          configuration.filters.conversationStatus,
      );
    }

    if (configuration.filters.searchQuery) {
      const query = configuration.filters.searchQuery.toLowerCase();
      filteredData = filteredData.filter((candidate: any) => {
        return Object.values(candidate).some((value) => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query);
          }
          return false;
        });
      });
    }

    if (configuration.sorting.length === 0) {
      const customEnrichments = get(enrichmentsState);
      const sampleEnrichments = get(sampleEnrichmentsState);
      const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<
        any[]
      >((accumulator, current) => {
        const exists = accumulator.find(
          (item) => item.modelName === current.modelName,
        );
        if (!exists) {
          return [...accumulator, current];
        }
        return accumulator;
      }, []);

      const aiFilterFields = allAiFilters.flatMap(
        (aiFilter) => aiFilter.fields?.map((field: any) => field.name) || [],
      );

      filteredData = sortCandidates(filteredData, customSort, aiFilterFields);
    }

    return filteredData;
  },
});

export const columnsSelector = createAtomSelector({
  key: 'columnsSelector',
  get: ({ get }) => {
    const unreadMessagesCounts = get(unreadMessagesCountsState);
    const processedData = get(processedDataSelector);
    const searchResults = get(searchResultsState);
    const customEnrichments = get(enrichmentsState);
    const sampleEnrichments = get(sampleEnrichmentsState);

    const processedDataIds = new Set<string>();
    processedData.forEach((candidate: any) => {
      const candidateId = candidate.tempId || candidate.id;
      if (candidateId) {
        processedDataIds.add(candidateId);
      }
    });

    const uniqueSearchResults = searchResults.filter((candidate: any) => {
      const candidateId = candidate.tempId || candidate.id;
      return !candidateId || !processedDataIds.has(candidateId);
    });

    const mergedData = [...processedData, ...uniqueSearchResults];

    const allAiFilters = [...customEnrichments, ...sampleEnrichments].reduce<
      Enrichment[]
    >((accumulator, current) => {
      const exists = accumulator.find(
        (item) => item.modelName === current.modelName,
      );
      if (!exists) {
        return [...accumulator, current];
      }
      return accumulator;
    }, []);

    if (allAiFilters.length > 0) {
      console.log('customEnrichments in columnsSelector:', customEnrichments);
      console.log('sampleEnrichments in columnsSelector:', sampleEnrichments);
      console.log('merged allAiFilters in columnsSelector:', allAiFilters);
    }

    return TableColumns({
      processedData: mergedData,
      unreadMessagesCounts,
      enrichments: allAiFilters,
    });
  },
});

export const candidateDataState = createAtomState<any>({
  key: 'candidate-table/candidateDataState',
  defaultValue: null,
});

export const projectsRefetchTriggerState = createAtomState<number>({
  key: 'candidate-table/projectsRefetchTriggerState',
  defaultValue: 0,
});

type ChatMessage = {
  id: string;
  type:
    | 'user'
    | 'assistant'
    | 'system'
    | 'search_parameters'
    | 'enrichments'
    | 'filters'
    | 'sorts';
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
};

export const chatMessagesState = createAtomState<ChatMessage[]>({
  key: 'candidate-table/chatMessagesState',
  defaultValue: [],
});

type SearchPlan = {
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
};

export const searchPlansState = createAtomState<SearchPlan[]>({
  key: 'candidate-table/searchPlansState',
  defaultValue: [],
});

export const resolvedParametersState = createAtomState<any>({
  key: 'candidate-table/resolvedParametersState',
  defaultValue: null,
});

export const chatMessagesSelector = createAtomWritableSelector({
  key: 'candidate-table/chatMessagesSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const stored = get(chatMessagesState);

    const job = projects.find((jobItem) => jobItem.id === projectId);

    if (!job) {
      return stored.length > 0 ? stored : [];
    }

    return stored;
  },
  set: ({ set }, newValue) => {
    set(chatMessagesState, newValue as ChatMessage[]);
  },
});

export const searchPlansSelector = createAtomWritableSelector({
  key: 'candidate-table/searchPlansSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const stored = get(searchPlansState);

    const job = projects.find((jobItem) => jobItem.id === projectId);

    if (!job) {
      return stored.length > 0 ? stored : [];
    }

    return stored;
  },
  set: ({ set }, newValue) => {
    set(searchPlansState, newValue as SearchPlan[]);
  },
});

export const updateFilterConfig =
  (setTableState: any) => (filterUpdates: Partial<FilterConfig>) => {
    setTableState((previous: TableState) => ({
      ...previous,
      configuration: {
        ...previous.configuration,
        filters: {
          ...previous.configuration.filters,
          ...filterUpdates,
        },
      },
    }));
  };

export const updateSortConfig =
  (setTableState: any) => (sortConfig: SortConfig[]) => {
    setTableState((previous: TableState) => ({
      ...previous,
      configuration: {
        ...previous.configuration,
        sorting: sortConfig,
      },
    }));
  };

export const clearAllFilters = (setTableState: any) => () => {
  setTableState((previous: TableState) => ({
    ...previous,
    configuration: {
      ...previous.configuration,
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
  setTableState((previous: TableState) => ({
    ...previous,
    configuration: {
      ...previous.configuration,
      sorting: [],
    },
  }));
};

export const resolvedParametersSelector = createAtomWritableSelector({
  key: 'candidate-table/resolvedParametersSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const stored = get(resolvedParametersState);
    const parsedJD = get(parsedJDInternalState);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(
        (thread) => thread.id === activeId,
      );
      if (activeThread?.assistantParameters?.resolvedSearchParameters) {
        return activeThread.assistantParameters.resolvedSearchParameters as Record<
          string,
          unknown
        >;
      }
    }
    const job = projects.find((jobItem) => jobItem.id === projectId);

    if (!job) {
      return stored;
    }

    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      const assistantParameters = threadNode?.assistantParameters;
      if (assistantParameters?.resolvedSearchParameters) {
        return assistantParameters.resolvedSearchParameters;
      }
    }

    return stored;
  },
  set: ({ set }, newValue) => {
    set(resolvedParametersState, newValue);
  },
});

export const enrichmentsSelector = createAtomSelector({
  key: 'candidate-table/enrichmentsSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const parsedJD = get(parsedJDInternalState);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(
        (thread) => thread.id === activeId,
      );
      if (
        activeThread?.enrichmentConfigs &&
        activeThread.enrichmentConfigs.length > 0
      ) {
        return activeThread.enrichmentConfigs;
      }
    }
    const job = projects.find((jobItem) => jobItem.id === projectId);
    if (!job) return [];

    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      if (
        threadNode?.enrichmentConfigs &&
        threadNode.enrichmentConfigs.length > 0
      ) {
        return threadNode.enrichmentConfigs;
      }
    }

    return [];
  },
});

export const filtersSelector = createAtomSelector({
  key: 'candidate-table/filtersSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const parsedJD = get(parsedJDInternalState);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(
        (thread) => thread.id === activeId,
      );
      if (
        activeThread?.columnFilters &&
        Array.isArray(activeThread.columnFilters) &&
        activeThread.columnFilters.length > 0
      ) {
        return activeThread.columnFilters;
      }
    }
    const job = projects.find((jobItem) => jobItem.id === projectId);
    if (!job) return [];

    const assistantThreadEdges = (job as any)?.assistantThread?.edges || [];
    if (assistantThreadEdges.length > 0) {
      const threadNode = assistantThreadEdges[0]?.node;
      if (
        threadNode?.columnFilters &&
        threadNode.columnFilters.length > 0
      ) {
        return threadNode.columnFilters;
      }
    }
    return [];
  },
});

export const sortsSelector = createAtomSelector({
  key: 'candidate-table/sortsSelector',
  get: ({ get }) => {
    const projectId = get(projectIdAtom);
    const projects = get(projectsState);
    const parsedJD = get(parsedJDInternalState);
    const activeId = get(activeAssistantThreadIdState);

    if (parsedJD?.assistantThreads && activeId) {
      const activeThread = parsedJD.assistantThreads.find(
        (thread) => thread.id === activeId,
      );
      if (
        activeThread?.sortColumns &&
        Array.isArray(activeThread.sortColumns) &&
        activeThread.sortColumns.length > 0
      ) {
        return activeThread.sortColumns;
      }
    }
    const job = projects.find((jobItem) => jobItem.id === projectId);

    if (!job) {
      return null;
    }

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

    return null;
  },
});

export type CandidatePersistenceState = 'fetched' | 'saved';

export const candidatePersistenceStateAtom = createAtomState<
  Record<string, CandidatePersistenceState>
>({
  key: 'candidate-table/candidatePersistenceStateAtom',
  defaultValue: {},
});

export const candidateStateSelector = createAtomSelector({
  key: 'candidate-table/candidateStateSelector',
  get: ({ get }) => {
    const persistenceStates = get(candidatePersistenceStateAtom);

    return (candidate: any): CandidatePersistenceState => {
      if (persistenceStates[candidate.id || candidate.linkedinId]) {
        const explicitState =
          persistenceStates[candidate.id || candidate.linkedinId];
        return explicitState;
      }

      if (candidate.personId) {
        return 'saved';
      }

      return 'fetched';
    };
  },
});

export const getRowBorderColor = (
  candidate: any,
  getCandidateState: (candidate: any) => CandidatePersistenceState,
): string => {
  const state = getCandidateState(candidate);

  switch (state) {
    case 'fetched':
      return '#3b82f6';
    case 'saved':
      return '#10b981';
    default:
      return '#10b981';
  }
};
