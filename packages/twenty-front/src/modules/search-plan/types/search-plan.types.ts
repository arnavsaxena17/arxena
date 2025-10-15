// Frontend types for search plan generation
export interface SearchVariation {
  id: string;
  name: string;
  type: 'broad' | 'narrow' | 'targeted';
  description: string;
  searchParameters: any; // Will be validated based on search type
  resolvedSearchParameters?: any; // LinkedIn IDs + display information
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

export interface EnrichmentField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues?: string[];
  required?: boolean;
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
    sampleDataSize?: number;
  };
}

export interface HandsontableFilter {
  column: string;
  type: 'text' | 'numeric' | 'date' | 'dropdown' | 'checkbox' | 'autocomplete';
  condition: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'not_contains' | 'begins_with' | 'ends_with' | 'empty' | 'not_empty' | 'between' | 'by_value';
  value?: any;
  value2?: any;
  options?: string[];
}

export interface CandidateSearchFilter {
  field: string;
  type: 'text_search' | 'dropdown_selection' | 'date_range' | 'numeric_range' | 'boolean' | 'multi_select' | 'location' | 'company' | 'industry' | 'seniority' | 'network_distance' | 'experience_range' | 'salary_range';
  label: string;
  value?: any;
  values?: any[];
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
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
    dataDistributionFields?: string[];
  };
}

// Chat message types for search plan generation
export interface SearchPlanChatMessage {
  id: string;
  type: 'search_parameters' | 'enrichments' | 'filters' | 'system';
  content: string;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
    actionButtons?: Array<{
      id: string;
      label: string;
      action: string;
      disabled?: boolean;
    }>;
  };
  timestamp: Date;
}
