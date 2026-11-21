export type AiFilterConfig = {
  id: string;
  name: string;
  [key: string]: unknown;
};

  import {
    type ClassicCompaniesSearchParameters,
    type ClassicJobsSearchParameters,
    type ClassicPeopleSearchParameters,
    type RecruiterPeopleSearchParameters,
    type SalesNavigatorCompaniesSearchParameters,
    type SalesNavigatorPeopleSearchParameters,
    type SearchParametersResponse,
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
  searchParameters?: Array<{
    generatedSearchParameters?: GeneratedSearchParameters;
    resolvedSearchParameters?: GeneratedSearchParameters;
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
  /** DB snapshot at fetch time — do not mutate when the user edits the form */
  existingChatQuestions?: string[];
  /** Candidate field IDs parallel to existingChatQuestions (by index) */
  chatQuestionFieldIds?: string[];
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

