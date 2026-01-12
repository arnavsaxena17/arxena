import { ParsedJobDescription } from '@/engine/core-modules/candidate-search/types/candidate-search-request.type';
import { LinkedInSearchResult } from '@/engine/core-modules/candidate-search/types/linkedin-search-result.type';

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

// Enrichment Types
export interface EnrichmentField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues: string[] | null;
  required: boolean | null;
}

export interface EnrichmentConfig {
  id: string;
  name: string;
  description: string;
  category: 'skills' | 'seniority' | 'location' | 'experience' | 'cultural' | 'custom';
  fields: EnrichmentField[];
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
    hasEnrichments: boolean;
    enrichmentsCount: number;
    hasFilters: boolean;
    filtersCount: number;
  };
}

// Request Types
export interface GenerateSearchParametersRequest {
  searchFilterId: string;
  parsedJD: ParsedJobDescription;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  searchCategory: 'people' | 'companies' | 'jobs';
}

export interface GenerateEnrichmentsRequest {
  searchFilterId: string;
  parsedJD: ParsedJobDescription;
  sampleResults?: LinkedInSearchResult[];
  columnData?: Record<string, any[]>;
}

export interface GenerateFiltersRequest {
  searchFilterId: string;
  parsedJD: ParsedJobDescription;
  enrichments: EnrichmentsResponse;
  sampleResults?: LinkedInSearchResult[]; // Enriched sample results
  dataDistribution?: Record<string, { min: number; max: number; avg: number; count: number }>;
}

export interface GenerateSortsRequest {
  searchFilterId: string;
  parsedJD: ParsedJobDescription;
  searchParameters: SearchParametersResponse;
  enrichments: EnrichmentsResponse;
  filters: FiltersResponse;
  sampleResults?: LinkedInSearchResult[]; // Enriched sample results
}

// Search Context for tracking search state
export interface SearchContext {
  searchFilterId: string;
  lastSearchType?: 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  lastGeneratedParams?: any; // GeneratedSearchParameters
  lastQueryUnderstanding?: any; // QueryUnderstanding
  pendingClarification?: {
    questions: string[];
    timestamp: string;
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

export interface ChatMessageResponse {
  success: boolean;
  type?: 'search_parameters' | 'enrichments' | 'filters' | 'sorts' | 'complete_plan';
  data?: any;
  chatMessage: string;
  error?: string;
}

// JD Complexity Analysis
export interface JDComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex';
  factors: {
    skillsCount: number;
    seniorityLevels: string[];
    roleDiversity: number;
    locationSpecificity: boolean;
    industrySpecificity: boolean;
    experienceRange: { min: number; max: number };
  };
  reasoning: string;
}

// Data Distribution for Filter Generation
export interface DataDistribution {
  field: string;
  type: 'numeric' | 'categorical' | 'boolean';
  distribution: {
    min?: number;
    max?: number;
    avg?: number;
    count: number;
    uniqueValues?: string[];
    valueCounts?: Record<string, number>;
  };
}

// Chat message types for search plan generation
export interface SearchPlanChatMessage {
  id: string;
  type: 'search_parameters' | 'enrichments' | 'filters' | 'sorts' | 'system';
  content: string;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
    sorts?: SortsResponse;
    actionButtons?: Array<{
      id: string;
      label: string;
      action: string;
      disabled?: boolean;
    }>;
  };
  timestamp: Date;
}
