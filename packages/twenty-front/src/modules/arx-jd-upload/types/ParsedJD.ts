import {
  ClassicCompaniesSearchParameters,
  ClassicJobsSearchParameters,
  // LinkedIn Search Parameter Types
  ClassicPeopleSearchParameters,
  EnrichmentConfig,
  EnrichmentsResponse,
  FiltersResponse,
  HandsontableFilter,
  RecruiterPeopleSearchParameters,
  SalesNavigatorCompaniesSearchParameters,
  SalesNavigatorPeopleSearchParameters,
  SearchParametersResponse,
  SortColumn,
  SortsResponse,
  SortStrategy
} from '@/candidate-search/types/candidate-search.types';

export type ParsedJD = {
  name: string;
  description: string;
  jobCode: string;
  jobLocation: string;
  salaryBracket: string;
  isActive: boolean;
  specificCriteria: string;
  pathPosition: string;
  companyName?: string;
  companyId?: string;
  companyDetails?: string;
  id?: string;
  parsedJobDescription?: any;
  filePath?: string;
  searchFilters?: SearchFilter[];
  chatFlow: {
    order: {
      initialChat: boolean;
      videoInterview: boolean;
      meetingScheduling: boolean;
    };
    questions: string[];
  };
  videoInterview: {
    questions: string[];
  };
  existingChatQuestions?: string[];
  meetingScheduling: {
    meetingType: 'walkIn' | 'online' | 'inPerson';
    availableDates: Array<{
      date: string;
      timeSlots: {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      };
    }>;
  };
};

// Properly typed SearchFilter interface - flattened structure
export interface SearchFilter {
  id: string;
  name: string;
  searchFilterParameter?: SearchFilterParameter;
  searchFilterName?: string;
  searchFilterFields?: any;
  chatHistory?: ChatMessage[];
  
  // Direct properties instead of nested objects
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

// Search Filter Parameter types
export interface SearchFilterParameter {
  generatedSearchParameters?: GeneratedSearchParameters;
  resolvedSearchParameters?: GeneratedSearchParameters;
}

// Generated Search Parameters (properly typed)
export interface GeneratedSearchParameters {
  classicPeopleSearch?: ClassicPeopleSearchParameters;
  classicCompaniesSearch?: ClassicCompaniesSearchParameters;
  classicJobsSearch?: ClassicJobsSearchParameters;
  salesNavigatorPeopleSearch?: SalesNavigatorPeopleSearchParameters;
  salesNavigatorCompaniesSearch?: SalesNavigatorCompaniesSearchParameters;
  recruiterPeopleSearch?: RecruiterPeopleSearchParameters;
}

// Chat Message type
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Re-export types for convenience
export type {
  ClassicCompaniesSearchParameters,
  ClassicJobsSearchParameters,
  // LinkedIn Search Parameter Types
  ClassicPeopleSearchParameters, EnrichmentConfig, EnrichmentsResponse,
  FiltersResponse, HandsontableFilter, RecruiterPeopleSearchParameters, SalesNavigatorCompaniesSearchParameters, SalesNavigatorPeopleSearchParameters, SearchParametersResponse, SortColumn, SortsResponse, SortStrategy
};

