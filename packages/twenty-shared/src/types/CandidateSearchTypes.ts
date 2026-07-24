export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';
export type LinkedInSearchCategory = 'people' | 'companies' | 'posts' | 'jobs';

export type SearchAiFilterField = {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'enum';
  description: string;
  enumValues?: string[] | null;
  required?: boolean | null;
};

export type AiFilterConfig = {
  id: string;
  name: string;
  description: string;
  category: 'skills' | 'seniority' | 'location' | 'experience' | 'cultural' | 'custom';
  fields: SearchAiFilterField[];
  prompt: string;
  selectedMetadataFields: string[];
  model: string;
  reasoning: string;
};

export type AiFiltersResponse = {
  aiFilters: AiFilterConfig[];
  overallStrategy: string;
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasSampleData: boolean;
    sampleDataSize?: number | null;
  };
};

export type HandsontableFilterType =
  | 'text'
  | 'numeric'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'autocomplete';

export type HandsontableFilterCondition =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'not_contains'
  | 'begins_with'
  | 'ends_with'
  | 'empty'
  | 'not_empty'
  | 'between'
  | 'by_value';

export type HandsontableFilter = {
  column: string;
  type: HandsontableFilterType;
  condition: HandsontableFilterCondition;
  value: unknown;
  value2?: unknown;
  options?: string[] | null;
};

export type FilterStrategy = {
  name: string;
  description: string;
  targetShortlistSize: number;
  priority: 'quality' | 'quantity' | 'balanced';
  reasoning: string;
};

export type FiltersResponse = {
  filterStrategy: FilterStrategy;
  handsontableFilters: HandsontableFilter[];
  candidateSearchFilters: unknown[];
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasDataDistribution: boolean;
    dataDistributionFields?: string[] | null;
    hasSampleData?: boolean | null;
    sampleDataSize?: number | null;
  };
};

export type SortOrder = 'asc' | 'desc';

export type SortColumn = {
  column: string;
  sortOrder: SortOrder;
  priority: number;
  reasoning: string;
};

export type SortStrategy = {
  name: string;
  description: string;
  reasoning: string;
  sortColumns: SortColumn[];
};

export type SortsResponse = {
  sortStrategy: SortStrategy;
  reasoning: string;
  metadata: {
    generatedAt: string;
    hasSampleData: boolean;
    sampleDataSize?: number | null;
    hasAiFilters: boolean;
    aiFiltersCount: number;
    hasFilters: boolean;
    filtersCount: number;
  };
};

