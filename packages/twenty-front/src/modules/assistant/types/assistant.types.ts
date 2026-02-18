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

export type AssistantThread = {
  id: string;
  name: string;
  messages: AssistantChatMessage[];
  lastTableData: AssistantTableData | null;
};
