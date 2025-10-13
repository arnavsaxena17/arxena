// Storage types for search plan data in the database
export interface StoredSearchPlan {
  searchParameters?: {
    variations: Array<{
      id: string;
      name: string;
      type: 'broad' | 'narrow' | 'targeted';
      description: string;
      searchParameters: any; // JSON object
      expectedResultSize: 'small' | 'medium' | 'large';
      reasoning: string;
    }>;
    overallStrategy: string;
    complexity: 'simple' | 'moderate' | 'complex';
    reasoning: string;
    metadata: {
      searchType: 'classic' | 'sales_navigator' | 'recruiter';
      searchCategory: 'people' | 'companies' | 'jobs';
      generatedAt: string;
    };
  };
  
  enrichments?: {
    enrichments: Array<{
      id: string;
      name: string;
      description: string;
      category: 'skills' | 'seniority' | 'location' | 'experience' | 'cultural' | 'custom';
      fields: Array<{
        name: string;
        type: 'text' | 'number' | 'boolean' | 'enum';
        description: string;
        enumValues?: string[];
        required?: boolean;
      }>;
      prompt: string;
      selectedMetadataFields: string[];
      model: string;
      reasoning: string;
    }>;
    overallStrategy: string;
    reasoning: string;
    metadata: {
      generatedAt: string;
      hasSampleData: boolean;
      sampleDataSize?: number;
    };
  };
  
  filters?: {
    filterStrategy: {
      name: string;
      description: string;
      targetShortlistSize: number;
      priority: 'quality' | 'quantity' | 'balanced';
      reasoning: string;
    };
    handsontableFilters: Array<{
      column: string;
      type: 'text' | 'numeric' | 'date' | 'dropdown' | 'checkbox' | 'autocomplete';
      condition: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains' | 'not_contains' | 'begins_with' | 'ends_with' | 'empty' | 'not_empty' | 'between' | 'by_value';
      value?: any;
      value2?: any;
      options?: string[];
    }>;
    candidateSearchFilters: Array<{
      field: string;
      type: 'text_search' | 'dropdown_selection' | 'date_range' | 'numeric_range' | 'boolean' | 'multi_select' | 'location' | 'company' | 'industry' | 'seniority' | 'network_distance' | 'experience_range' | 'salary_range';
      label: string;
      value?: any;
      values?: any[];
      min?: number;
      max?: number;
      options?: string[];
      placeholder?: string;
    }>;
    reasoning: string;
    metadata: {
      generatedAt: string;
      hasDataDistribution: boolean;
      dataDistributionFields?: string[];
    };
  };
  
  metadata: {
    createdAt: string;
    updatedAt: string;
    version: string;
    generatedBy: 'ai' | 'manual';
  };
}

// Chat message types for search plan generation
export interface SearchPlanChatMessage {
  id: string;
  type: 'search_parameters' | 'enrichments' | 'filters' | 'system';
  content: string;
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
  timestamp: Date;
}

// Response types for API endpoints
export interface SearchPlanGenerationResponse {
  success: boolean;
  data?: any;
  error?: string;
  chatMessage?: SearchPlanChatMessage;
}
