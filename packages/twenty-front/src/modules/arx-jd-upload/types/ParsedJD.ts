export type AiFilterConfig = {
  id: string;
  name: string;
  [key: string]: unknown;
};

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
  /** Assistant threads used for candidate-search chat (replaces searchFilters for chat flow) */
  assistantThreads?: AssistantThreadSummary[];
  searchParameters?: Array<{
    generatedSearchParameters?: GeneratedSearchParameters;
    resolvedSearchParameters?: GeneratedSearchParameters;
    assistantThreadId?: string;
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

/** Summary of an assistant thread for candidate-search (id, name, parameters, enrichments) */
export type AssistantThreadSummary = {
  id: string;
  name: string;
  assistantParameters?: {
    generatedSearchParameters?: Record<string, unknown>;
    resolvedSearchParameters?: Record<string, unknown>;
    [key: string]: unknown;
  };
  enrichmentConfigs?: AiFilterConfig[];
  columnFilters?: unknown[];
  [key: string]: unknown;
};

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
  ClassicPeopleSearchParameters,
  RecruiterPeopleSearchParameters,
  SalesNavigatorCompaniesSearchParameters,
  SalesNavigatorPeopleSearchParameters,
  SearchParametersResponse
};

