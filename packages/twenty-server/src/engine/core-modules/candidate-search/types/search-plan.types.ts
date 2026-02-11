import { ParsedJobDescription } from '@/engine/core-modules/candidate-search/types/candidate-search-request.type';

// Search Variation Types
export type SearchVariationType = 'broad' | 'narrow' | 'targeted';

export interface SearchVariation {
  id: string;
  name: string;
  type: SearchVariationType;
  description: string;
  searchParameters: any; // Will be validated based on search type
  expectedResultSize: 'small' | 'medium' | 'large';
  reasoning: string;
}

export interface SearchParametersResponse {
  variations: SearchVariation[];
  overallStrategy: string;
  complexity: 'simple' | 'moderate' | 'complex';
  reasoning: string;
  metadata: {
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    searchCategory: 'people' | 'companies' | 'jobs';
    generatedAt: string;
  };
}

// AI Filter Types
export interface AiFilterField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues: string[] | null;
  required: boolean | null;
}

export interface AiFilterConfig {
  id: string;
  name: string;
  description: string;
  category: 'skills' | 'seniority' | 'location' | 'experience' | 'cultural' | 'custom';
  fields: AiFilterField[];
  prompt: string;
  selectedMetadataFields: string[];
  model: string;
  reasoning: string;
}

export interface AiFiltersResponse {
  aiFilters: AiFilterConfig[];
  overallStrategy: string;
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasSampleData: boolean;
    sampleDataSize: number | null;
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
  | 'begins_with'  // begins with
  | 'ends_with'    // ends with
  | 'empty'        // is empty
  | 'not_empty'    // is not empty
  | 'between'      // between (for numeric/date)
  | 'by_value';    // by value (for dropdown)

export interface HandsontableFilter {
  column: string;
  type: HandsontableFilterType;
  condition: HandsontableFilterCondition;
  value: any | null;
  value2: any | null; // for 'between' condition
  options: string[] | null; // for dropdown/autocomplete
}

export type CandidateSearchFilterType = 
  | 'text_search'
  | 'dropdown_selection'
  | 'date_range'
  | 'numeric_range'
  | 'boolean'
  | 'multi_select'
  | 'location'
  | 'company'
  | 'industry'
  | 'seniority'
  | 'network_distance'
  | 'experience_range'
  | 'salary_range';

export interface CandidateSearchFilter {
  field: string;
  type: CandidateSearchFilterType;
  label: string;
  value: any | null;
  values: any[] | null; // for multi-select
  min: number | null;   // for range filters
  max: number | null;   // for range filters
  options: string[] | null; // for dropdown/multi-select
  placeholder: string | null;
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
  candidateSearchFilters: CandidateSearchFilter[];
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasDataDistribution: boolean;
    dataDistributionFields: string[] | null;
    hasSampleData: boolean | null;
    sampleDataSize: number | null;
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
    hasAiFilters: boolean;
    aiFiltersCount: number;
    hasFilters: boolean;
    filtersCount: number;
  };
}


// Message processing types
export interface ChatMessageRequest {
  includeJd?: boolean;
  searchFilterId: string;
  message: string;
  parsedJD: ParsedJobDescription;
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory?: 'people' | 'companies' | 'posts' | 'jobs';
  sampleResults?: any[];
  dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>;
}

