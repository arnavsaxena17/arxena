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
    generatedSearchParameters: any; // Human-readable text parameters for display
    resolvedSearchParameters?: any; // LinkedIn IDs for API calls
  }>;
  searchFilters?: Array<{
    id: string;
    name: string;
    searchFilterParameter?: any;
    searchFilterName?: string;
    searchFilterFields?: any;
    chatHistory?: Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    enrichmentConfigs?: any[];
    columnFilters?: any[];
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