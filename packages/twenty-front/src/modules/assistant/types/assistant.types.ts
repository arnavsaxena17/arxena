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
  orgCharts?: OrgChartPreview[];
};

export type AgentNote = {
  summary: string;
  createdAt?: string;
  id?: string;
};

export type AssistantThread = {
  id: string;
  name: string;
  messages: AssistantChatMessage[];
  lastTableData: AssistantTableData | null;
  jobId?: string | null;
  agentNotes?: AgentNote[];
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
