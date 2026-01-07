import {
  EnrichmentsResponse,
  FiltersResponse,
  SearchParametersResponse,
  SortsResponse,
} from '@/candidate-search/types/candidate-search.types';

// Use the ChatMessage type from the state
export type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
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
    clarification?: {
      questions: string[];
      ambiguityReasons?: string[];
    };
  };
};

