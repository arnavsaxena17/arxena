import { SearchParametersResponse } from '@/candidate-search/types/candidate-search.types';
import type { AiFiltersResponse, FiltersResponse, SortsResponse } from 'twenty-shared/types';

// Use the ChatMessage type from the state
  export type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    aiFilters?: AiFiltersResponse;
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
    tokenUsage?: {
      total: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens: number;
      };
      byStage: Record<string, {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens: number;
        cost: number;
        count: number;
      }>;
      totalCost: number;
    };
  };
  };