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

export type AssistantThread = {
  id: string;
  name: string;
  messages: AssistantChatMessage[];
  lastTableData: AssistantTableData | null;
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
