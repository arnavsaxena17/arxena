import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';

export type OrgChartPreview = {
  companyId: string;
  companyName: string;
  slug: string;
  viewUrl: string;
  country?: string;
  functionRoot?: string;
};

export type AssistantChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ content: string }>;
  tableDataList?: AssistantTableData[];
  tableReferences?: Array<{
    tableId: string;
    ref: string;
    tableType?: string;
    label?: string;
    count?: number;
    columns?: string[];
    createdAt?: number;
  }>;
  orgCharts?: OrgChartPreview[];
};

export type AgentNote = {
  summary: string;
  createdAt?: string;
  id?: string;
};

export type AssistantThreadJob = {
  id: string;
  name?: string;
  jobLocation?: string;
  company?: { id: string; name?: string };
};

export type LinkedInSearchType = 'classic' | 'sales_navigator' | 'recruiter';

export type AssistantIterativeQueryResult = {
  final_query_set: {
    search_query_set: Array<{
      keywords: string | null;
      job_title: string | null;
      company: string[] | null;
      location: string[] | null;
      years_of_experience: string | null;
    }>;
  };
  ranked_alternatives: Array<{
    query_set: {
      search_query_set: Array<{
        keywords: string | null;
        job_title: string | null;
        company: string[] | null;
        location: string[] | null;
        years_of_experience: string | null;
      }>;
    };
    score: number;
    summary: string;
    rejection_reason?: string | null;
  }>;
  iterations: Array<{
    round: number;
    winner_candidate_id: string;
    winner_score: number;
    improvement_from_previous: number | null;
  }>;
  verification_summary: {
    mode: 'offline' | 'live';
    final_score: number;
    termination_reason:
      | 'max_iterations_reached'
      | 'good_enough'
      | 'no_meaningful_improvement';
    live_preview_used: boolean;
    live_preview_fallback_reason?: string | null;
  };
};

export type AssistantIterativeQueryState = {
  baseRequirement?: string;
  effectiveRequirement?: string;
  steeringHistory?: Array<{ message?: string; createdAt?: string }>;
  progressLog?: Array<{ message?: string; stage?: string; createdAt?: string }>;
  lastResult?: AssistantIterativeQueryResult;
  version?: number;
  updatedAt?: string;
};

export type AssistantThread = {
  id: string;
  name: string;
  messages: AssistantChatMessage[];
  lastTableData: AssistantTableData | null;
  assistantParameters?: Record<string, unknown> & {
    iterativeQueryState?: AssistantIterativeQueryState;
  };
  assistantSearchStrategy?: Record<string, unknown>;
  jobId?: string | null;
  job?: AssistantThreadJob | null;
  agentNotes?: AgentNote[];
  agentEvents?: AssistantAgentEvent[];
  assistantMode?: 'fully_autonomous' | 'permissioned';
  searchType?: LinkedInSearchType;
};

export type AssistantAgentEvent = {
  status: 'started' | 'completed' | 'error' | 'tool_call';
  threadId?: string;
  runId?: string;
  summary?: string;
  error?: string;
  toolName?: string;
  timestamp: number;
};
