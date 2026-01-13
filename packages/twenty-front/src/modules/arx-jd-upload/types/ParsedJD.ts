import {
  SearchFilter as BaseSearchFilter,
  // LinkedIn Search Parameter Types
  EnrichmentConfig,
  EnrichmentsResponse,
  FiltersResponse,
  HandsontableFilter,
  SortColumn,
  SortStrategy,
  SortsResponse
} from 'twenty-shared';

import {
  ClassicCompaniesSearchParameters,
  ClassicJobsSearchParameters,
  ClassicPeopleSearchParameters,
  RecruiterPeopleSearchParameters,
  SalesNavigatorCompaniesSearchParameters,
  SalesNavigatorPeopleSearchParameters,
  SearchParametersResponse,
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
  searchParameters?: Array<{
    generatedSearchParameters?: GeneratedSearchParameters;
    resolvedSearchParameters?: GeneratedSearchParameters;
    searchFilterId?: string;
  }>;
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

// Extended SearchFilter interface for frontend - adds frontend-specific fields
export interface SearchFilter extends BaseSearchFilter {
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

// Generated Search Parameters (frontend-specific with typed parameters)
export interface GeneratedSearchParameters {
  classicPeopleSearch?: ClassicPeopleSearchParameters;
  classicCompaniesSearch?: ClassicCompaniesSearchParameters;
  classicJobsSearch?: ClassicJobsSearchParameters;
  salesNavigatorPeopleSearch?: SalesNavigatorPeopleSearchParameters;
  salesNavigatorCompaniesSearch?: SalesNavigatorCompaniesSearchParameters;
  recruiterPeopleSearch?: RecruiterPeopleSearchParameters;
}

// Re-export types for convenience
export type {
  ClassicCompaniesSearchParameters,
  ClassicJobsSearchParameters,
  // LinkedIn Search Parameter Types
  ClassicPeopleSearchParameters, EnrichmentConfig, EnrichmentsResponse,
  FiltersResponse, HandsontableFilter, RecruiterPeopleSearchParameters, SalesNavigatorCompaniesSearchParameters, SalesNavigatorPeopleSearchParameters, SearchParametersResponse, SortColumn, SortStrategy, SortsResponse
};

