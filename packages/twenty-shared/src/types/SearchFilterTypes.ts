// LinkedIn Search Types
export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';
export type LinkedInSearchCategory = 'people' | 'companies' | 'jobs' | 'posts';

// Chat Message type for search filter chat history
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Search Filter Parameter types
export interface SearchFilterParameter {
  generatedSearchParameters?: GeneratedSearchParameters;
  resolvedSearchParameters?: GeneratedSearchParameters;
  pendingClarification?: {
    questions: string[];
    timestamp: string;
  };
}

// Generated Search Parameters - generic type that can be extended
// This allows both frontend and backend to use compatible types
// Backend may include strategy arrays, frontend uses specific parameter types
export interface GeneratedSearchParameters {
  [key: string]: unknown;
  // Common search parameter keys (can be extended by specific implementations)
  classicPeopleSearch?: unknown;
  classicPeopleSearchStrategies?: unknown[];
  classicCompaniesSearch?: unknown;
  classicJobsSearch?: unknown;
  salesNavigatorPeopleSearch?: unknown;
  salesNavigatorPeopleSearchStrategies?: unknown[];
  salesNavigatorCompaniesSearch?: unknown;
  recruiterPeopleSearch?: unknown;
  recruiterPeopleSearchStrategies?: unknown[];
}

// Enrichment Types
export interface SearchEnrichmentField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues?: string[] | null;
  required?: boolean | null;
}

export interface EnrichmentConfig {
  id: string;
  name: string;
  description: string;
  category: 'skills' | 'seniority' | 'location' | 'experience' | 'cultural' | 'custom';
  fields: SearchEnrichmentField[];
  prompt: string;
  selectedMetadataFields: string[];
  model: string;
  reasoning: string;
}

export interface EnrichmentsResponse {
  enrichments: EnrichmentConfig[];
  overallStrategy: string;
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasSampleData: boolean;
    sampleDataSize?: number | null;
  };
}

// Filter Types
export type HandsontableFilterType = 
  | 'text'
  | 'numeric'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'autocomplete';

export type HandsontableFilterCondition = 
  | 'eq'           // equals
  | 'neq'          // not equal
  | 'lt'           // less than
  | 'lte'          // less than or equal
  | 'gt'           // greater than
  | 'gte'          // greater than or equal
  | 'contains'     // contains
  | 'not_contains' // does not contain
  | 'begins_with'   // begins with
  | 'ends_with'    // ends with
  | 'empty'        // is empty
  | 'not_empty'    // is not empty
  | 'between'      // between (for numeric/date)
  | 'by_value';    // by value (for dropdown)

export interface HandsontableFilter {
  column: string;
  type: HandsontableFilterType;
  condition: HandsontableFilterCondition;
  value?: any | null;
  value2?: any | null; // for 'between' condition
  options?: string[] | null; // for dropdown/autocomplete
}

export interface FilterStrategy {
  name: string;
  description: string;
  targetShortlistSize: number;
  priority: 'quality' | 'quantity' | 'balanced';
  reasoning: string;
}

export interface FiltersResponse {
  filterStrategy: FilterStrategy;
  handsontableFilters: HandsontableFilter[];
  candidateSearchFilters?: any[]; // Frontend-specific, optional for compatibility
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasDataDistribution: boolean;
    dataDistributionFields?: string[] | null;
    hasSampleData?: boolean | null;
    sampleDataSize?: number | null;
  };
}

// Sort Types
export type SortOrder = 'asc' | 'desc';

export interface SortColumn {
  column: string;
  sortOrder: SortOrder;
  priority: number;
  reasoning: string;
}

export interface SortStrategy {
  name: string;
  description: string;
  reasoning: string;
  sortColumns: SortColumn[];
}

export interface SortsResponse {
  sortStrategy: SortStrategy;
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasSampleData: boolean;
    sampleDataSize: number | null;
    hasEnrichments?: boolean;
    enrichmentsCount?: number;
    hasFilters?: boolean;
    filtersCount?: number;
  };
}

export interface SearchFilter {
  id: string;
  name?: string;
  searchFilterParameter?: SearchFilterParameter;
  searchFilterName?: string;
  searchFilterFields?: unknown;
  chatHistory?: ChatMessage[];
  jobId?: string;
  // Additional fields that may be present from GraphQL
  [key: string]: unknown;



  enrichmentConfigs?: EnrichmentConfig[];
  columnFilters?: HandsontableFilter[];
  sortColumns?: SortColumn[];  // Direct access to sort columns
  sortStrategyName?: string;   // Strategy name for reference
  sortStrategyDescription?: string; // Strategy description
  sortStrategyReasoning?: string;   // Strategy reasoning
  
  // Legacy field names for backward compatibility
  // searchStrategy?: SortStrategy;     // Keep for backward compatibility
  columnSortConfigs?: SortStrategy; // Keep for backward compatibility
}

